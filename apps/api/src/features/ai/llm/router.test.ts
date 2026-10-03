import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { randomUUID } from "node:crypto"
import {
  APICallError,
  type FinishReason,
  type LanguageModelUsage,
  type TextStreamPart,
  type ToolSet,
} from "ai"
import type Redis from "ioredis"
import { redis } from "@/lib/redis"
import {
  generateTextWithFailover,
  streamTextWithFailover,
  type LlmRouterOptions,
} from "./router"
import type { LlmAdapter, LlmRoute, LlmStream, LlmTextResult } from "./types"

const usage: LanguageModelUsage = {
  inputTokens: 1,
  outputTokens: 1,
  totalTokens: 2,
  inputTokenDetails: {
    noCacheTokens: 1,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  },
  outputTokenDetails: {
    textTokens: 1,
    reasoningTokens: 0,
  },
}

function textResult(text: string): LlmTextResult {
  return {
    text,
    finishReason: "stop",
    usage,
    costUsd: 0,
  }
}

function streamOf(parts: Array<TextStreamPart<ToolSet> | Error>): LlmStream {
  return {
    stream: (async function* () {
      for (const part of parts) {
        if (part instanceof Error) throw part
        yield part
      }
    })(),
    usage: Promise.resolve(usage),
    finishReason: Promise.resolve("stop" as FinishReason),
    costUsd: Promise.resolve(0),
  }
}

function rateLimitError() {
  return new APICallError({
    message: "rate limit",
    url: "https://example.com",
    requestBodyValues: {},
    statusCode: 429,
    responseHeaders: { "retry-after": "1" },
    isRetryable: true,
  })
}

function badRequestError() {
  return new APICallError({
    message: "bad request",
    url: "https://example.com",
    requestBodyValues: {},
    statusCode: 400,
    isRetryable: false,
  })
}

function routes(): LlmRoute[] {
  return [
    {
      modelId: "model",
      vendorName: "secondary",
      adapter: "secondary",
      apiName: "secondary-model",
      priority: 50,
      cooldownMs: 15_000,
    },
    {
      modelId: "model",
      vendorName: "primary",
      adapter: "primary",
      apiName: "primary-model",
      priority: 10,
      cooldownMs: 15_000,
    },
  ]
}

describe("llm failover", () => {
  let prefix: string
  let calls: string[]

  beforeEach(() => {
    prefix = `test:${randomUUID()}:`
    calls = []
  })

  afterEach(async () => {
    const keys = await redis.keys(`${prefix}*`)
    if (keys.length > 0) await redis.del(...keys)
  })

  function options(
    adapters: Record<string, Pick<LlmAdapter, "generateText" | "streamText">>,
    redisClient: Redis = redis,
  ): LlmRouterOptions {
    return {
      redis: redisClient,
      keyPrefix: prefix,
      random: () => 0.5,
      listRoutes: async () => routes(),
      resolveAdapter: (adapter) => ({
        name: adapter,
        generateText: async (input) => {
          calls.push(adapter)
          return adapters[adapter]!.generateText(input)
        },
        streamText: (input) => {
          calls.push(adapter)
          return adapters[adapter]!.streamText(input)
        },
      }),
    }
  }

  const request = {
    modelId: "model",
    messages: [{ role: "user" as const, content: "hi" }],
    abortSignal: new AbortController().signal,
  }

  test("tries the lower priority number first", async () => {
    const result = await generateTextWithFailover(
      request,
      options({
        primary: {
          generateText: async () => textResult("primary"),
          streamText: () => streamOf([]),
        },
        secondary: {
          generateText: async () => textResult("secondary"),
          streamText: () => streamOf([]),
        },
      }),
    )
    expect(result.text).toBe("primary")
    expect(calls).toEqual(["primary"])
  })

  test("a 429 cools the vendor and the next vendor serves the call", async () => {
    const result = await generateTextWithFailover(
      request,
      options({
        primary: {
          generateText: async () => {
            throw rateLimitError()
          },
          streamText: () => streamOf([]),
        },
        secondary: {
          generateText: async () => textResult("secondary"),
          streamText: () => streamOf([]),
        },
      }),
    )
    expect(result.text).toBe("secondary")
    expect(calls).toEqual(["primary", "secondary"])
    const cooled = await redis.get(`${prefix}llm:cd:primary:model`)
    expect(cooled).toBe("1")
    expect(await redis.pttl(`${prefix}llm:cd:primary:model`)).toBeGreaterThan(0)
  })

  test("a cooled vendor is skipped until the key expires", async () => {
    await redis.set(`${prefix}llm:cd:primary:model`, "1", "PX", 60)
    const adapters = {
      primary: {
        generateText: async () => textResult("primary"),
        streamText: () => streamOf([]),
      },
      secondary: {
        generateText: async () => textResult("secondary"),
        streamText: () => streamOf([]),
      },
    }
    const first = await generateTextWithFailover(request, options(adapters))
    expect(first.text).toBe("secondary")

    await redis.del(`${prefix}llm:cd:primary:model`)
    const second = await generateTextWithFailover(request, options(adapters))
    expect(second.text).toBe("primary")
  })

  test("a 400 is not failed over", async () => {
    await expect(
      generateTextWithFailover(
        request,
        options({
          primary: {
            generateText: async () => {
              throw badRequestError()
            },
            streamText: () => streamOf([]),
          },
          secondary: {
            generateText: async () => textResult("secondary"),
            streamText: () => streamOf([]),
          },
        }),
      ),
    ).rejects.toThrow("bad request")
    expect(calls).toEqual(["primary"])
  })

  test("a stream error after the first text delta is not failed over", async () => {
    const handle = await streamTextWithFailover(
      request,
      options({
        primary: {
          generateText: async () => textResult("primary"),
          streamText: () =>
            streamOf([
              { type: "text-delta", id: "1", text: "hello" },
              rateLimitError(),
            ]),
        },
        secondary: {
          generateText: async () => textResult("secondary"),
          streamText: () =>
            streamOf([{ type: "text-delta", id: "2", text: "other" }]),
        },
      }),
    )

    const parts: string[] = []
    await expect(async () => {
      for await (const part of handle.stream) {
        if (part.type === "text-delta") parts.push(part.text)
      }
    }).toThrow("rate limit")
    expect(parts).toEqual(["hello"])
    expect(calls).toEqual(["primary"])
  })

  test("a redis read error still attempts the primary vendor", async () => {
    const broken = {
      get: async () => {
        throw new Error("redis down")
      },
      set: async () => {
        throw new Error("redis down")
      },
      mget: async () => {
        throw new Error("redis down")
      },
      pipeline: () => {
        throw new Error("redis down")
      },
    } as unknown as Redis

    const result = await generateTextWithFailover(
      request,
      options(
        {
          primary: {
            generateText: async () => textResult("primary"),
            streamText: () => streamOf([]),
          },
          secondary: {
            generateText: async () => textResult("secondary"),
            streamText: () => streamOf([]),
          },
        },
        broken,
      ),
    )
    expect(result.text).toBe("primary")
    expect(calls).toEqual(["primary"])
  })
})
