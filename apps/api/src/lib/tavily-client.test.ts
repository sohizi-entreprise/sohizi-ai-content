import { afterEach, describe, expect, test } from "bun:test"
import { TavilyHttpError, tavilySearch } from "./tavily-client"

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe("tavily retry-after", () => {
  test("a 429 keeps the provider retry hint", async () => {
    globalThis.fetch = (async () =>
      new Response("slow down", {
        status: 429,
        headers: { "retry-after": "7" },
      })) as unknown as typeof fetch

    await expect(tavilySearch("key", { query: "weather" })).rejects.toMatchObject(
      { status: 429, retryAfterMs: 7_000 },
    )
  })

  test("a 429 without a usable hint leaves the delay unset", async () => {
    globalThis.fetch = (async () =>
      new Response("slow down", {
        status: 429,
        headers: { "retry-after": "later" },
      })) as unknown as typeof fetch

    try {
      await tavilySearch("key", { query: "weather" })
      throw new Error("expected a tavily error")
    } catch (error) {
      expect(error).toBeInstanceOf(TavilyHttpError)
      expect((error as TavilyHttpError).retryAfterMs).toBeUndefined()
    }
  })
})
