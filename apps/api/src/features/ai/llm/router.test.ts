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
import type {
  LlmAdapter,
  LlmCallInput,
  LlmRoute,
  LlmStream,
  LlmTextResult,
} from "./types"

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

function insufficientFundsError() {
  return new APICallError({
    message: "A positive credit balance is required",
    url: "https://ai-gateway.vercel.sh/v4/ai/language-model",
    requestBodyValues: {},
    statusCode: 402,
    isRetryable: false,
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

function serverError() {
  return new APICallError({
    message: "internal error",
    url: "https://example.com",
    requestBodyValues: {},
    statusCode: 500,
    isRetryable: true,
  })
}

function hangUntilAbort(input: LlmCallInput): Promise<LlmTextResult> {
  return new Promise((_, reject) => {
    const fail = () => {
      reject(
        input.abortSignal.reason instanceof Error
          ? input.abortSignal.reason
          : new DOMException("The operation was aborted.", "AbortError"),
      )
    }
    if (input.abortSignal.aborted) fail()
    else input.abortSignal.addEventListener("abort", fail, { once: true })
  })
}

function hungStream(): LlmStream {
  return {
    stream: (async function* () {
      await new Promise(() => {})
    })(),
    usage: Promise.resolve(usage),
    finishReason: Promise.resolve("stop" as FinishReason),
    costUsd: Promise.resolve(0),
  }
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
    expect(result.vendorName).toBe("primary")
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
    expect(result.vendorName).toBe("secondary")
    expect(calls).toEqual(["primary", "secondary"])
    const cooled = await redis.get(`${prefix}llm:cd:primary:model`)
    expect(cooled).toBe("1")
    expect(await redis.pttl(`${prefix}llm:cd:primary:model`)).toBeGreaterThan(0)
  })

  test("a 402 insufficient balance falls back to the next vendor", async () => {
    const result = await generateTextWithFailover(
      request,
      options({
        primary: {
          generateText: async () => {
            throw insufficientFundsError()
          },
          streamText: () => streamOf([]),
        },
        secondary: {
          generateText: async () => textResult("secondary"),
          streamText: () => streamOf([]),
        },
      }),
    )
    expect(result.vendorName).toBe("secondary")
    expect(calls).toEqual(["primary", "secondary"])
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
    expect(handle.vendorName).toBe("primary")
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
    expect(result.vendorName).toBe("primary")
    expect(calls).toEqual(["primary"])
  })

  test("a 500 cools the vendor and the next vendor serves the call", async () => {
    const result = await generateTextWithFailover(
      request,
      options({
        primary: {
          generateText: async () => {
            throw serverError()
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
    expect(result.vendorName).toBe("secondary")
    expect(calls).toEqual(["primary", "secondary"])
    expect(await redis.get(`${prefix}llm:cd:primary:model`)).toBe("1")
  })

  test("a stream error before the first text delta fails over", async () => {
    const handle = await streamTextWithFailover(
      request,
      options({
        primary: {
          generateText: async () => textResult("primary"),
          streamText: () =>
            streamOf([
              { type: "start" },
              { type: "error", error: serverError() },
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
    for await (const part of handle.stream) {
      if (part.type === "text-delta") parts.push(part.text)
    }
    expect(parts).toEqual(["other"])
    expect(handle.vendorName).toBe("secondary")
    expect(calls).toEqual(["primary", "secondary"])
  })

  test("a 402 stream error before content falls back to the next vendor", async () => {
    const handle = await streamTextWithFailover(
      request,
      options({
        primary: {
          generateText: async () => textResult("primary"),
          streamText: () =>
            streamOf([{ type: "error", error: insufficientFundsError() }]),
        },
        secondary: {
          generateText: async () => textResult("secondary"),
          streamText: () =>
            streamOf([{ type: "text-delta", id: "2", text: "other" }]),
        },
      }),
    )

    const parts: string[] = []
    for await (const part of handle.stream) {
      if (part.type === "text-delta") parts.push(part.text)
    }
    expect(parts).toEqual(["other"])
    expect(handle.vendorName).toBe("secondary")
    expect(calls).toEqual(["primary", "secondary"])
  })

  test("a silent generate attempt times out and the next vendor serves the call", async () => {
    const result = await generateTextWithFailover(request, {
      ...options({
        primary: {
          generateText: () => new Promise(() => {}),
          streamText: () => streamOf([]),
        },
        secondary: {
          generateText: async () => textResult("secondary"),
          streamText: () => streamOf([]),
        },
      }),
      generateAttemptTimeoutMs: 50,
    })
    expect(result.text).toBe("secondary")
    expect(result.vendorName).toBe("secondary")
    expect(calls).toEqual(["primary", "secondary"])
    expect(await redis.get(`${prefix}llm:cd:primary:model`)).toBe("1")
  })

  test("a silent stream times out before the first content part", async () => {
    const handle = await streamTextWithFailover(request, {
      ...options({
        primary: {
          generateText: async () => textResult("primary"),
          streamText: () => hungStream(),
        },
        secondary: {
          generateText: async () => textResult("secondary"),
          streamText: () =>
            streamOf([{ type: "text-delta", id: "2", text: "other" }]),
        },
      }),
      streamAttemptTimeoutMs: 50,
    })

    const parts: string[] = []
    for await (const part of handle.stream) {
      if (part.type === "text-delta") parts.push(part.text)
    }
    expect(parts).toEqual(["other"])
    expect(handle.vendorName).toBe("secondary")
    expect(calls).toEqual(["primary", "secondary"])
  })

  test("the attempt deadline stops once the stream produces content", async () => {
    const handle = await streamTextWithFailover(request, {
      ...options({
        primary: {
          generateText: async () => textResult("primary"),
          streamText: () =>
            streamOf([{ type: "text-delta", id: "1", text: "hello" }]),
        },
        secondary: {
          generateText: async () => textResult("secondary"),
          streamText: () =>
            streamOf([{ type: "text-delta", id: "2", text: "other" }]),
        },
      }),
      streamAttemptTimeoutMs: 50,
    })

    const parts: string[] = []
    for await (const part of handle.stream) {
      if (part.type === "text-delta") parts.push(part.text)
    }
    expect(parts).toEqual(["hello"])
    expect(calls).toEqual(["primary"])
  })

  test("an aborted call is not failed over", async () => {
    const controller = new AbortController()
    let started!: () => void
    const entered = new Promise<void>((resolve) => {
      started = resolve
    })
    const pending = generateTextWithFailover(
      { ...request, abortSignal: controller.signal },
      options({
        primary: {
          generateText: (input) => {
            started()
            return hangUntilAbort(input)
          },
          streamText: () => streamOf([]),
        },
        secondary: {
          generateText: async () => textResult("secondary"),
          streamText: () => streamOf([]),
        },
      }),
    )
    await entered
    controller.abort()
    await expect(pending).rejects.toThrow(/abort/i)
    expect(calls).toEqual(["primary"])
  })
})
