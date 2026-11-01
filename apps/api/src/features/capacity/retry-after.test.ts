import { describe, expect, test } from "bun:test"
import { APICallError } from "ai"
import { MediaRateLimitError } from "@/features/media-engine/providers/type"
import { RenderRateLimitError } from "@/features/video-editor/render-client"
import {
  isRateLimitError,
  parseRetryAfterHeader,
  rateLimitRetryAfterMs,
  retryAfterMsFrom,
} from "./retry-after"

const now = Date.parse("2026-10-20T12:00:00.000Z")

describe("retry-after parsing", () => {
  test("reads seconds, HTTP dates, and rejects invalid values", () => {
    expect(parseRetryAfterHeader("8", now)).toBe(8_000)
    expect(parseRetryAfterHeader("Tue, 20 Oct 2026 12:00:05 GMT", now)).toBe(
      5_000,
    )
    expect(parseRetryAfterHeader("0", now)).toBeUndefined()
    expect(parseRetryAfterHeader("-2", now)).toBeUndefined()
    expect(parseRetryAfterHeader("later", now)).toBeUndefined()
    expect(parseRetryAfterHeader("", now)).toBeUndefined()
  })

  test("reads adapter fields, headers, nested causes, and AWS metadata", () => {
    expect(retryAfterMsFrom({ retryAfterMs: 2_500 }, now)).toBe(2_500)
    expect(
      retryAfterMsFrom({ responseHeaders: { "Retry-After": "3" } }, now),
    ).toBe(3_000)
    expect(
      retryAfterMsFrom(
        new Error("wrapped", {
          cause: { headers: new Headers({ "retry-after": "4" }) },
        }),
        now,
      ),
    ).toBe(4_000)
    expect(
      retryAfterMsFrom(
        {
          $metadata: { httpStatusCode: 429 },
          $response: { headers: { "retry-after": ["6"] } },
        },
        now,
      ),
    ).toBe(6_000)
    expect(retryAfterMsFrom({ retryAfterMs: 0 }, now)).toBeUndefined()
    expect(retryAfterMsFrom(new Error("down"), now)).toBeUndefined()
  })

  test("only a 429 keeps the provider delay", () => {
    const limited = new APICallError({
      message: "limited",
      url: "https://example.com",
      requestBodyValues: {},
      statusCode: 429,
      responseHeaders: { "retry-after": "9" },
      isRetryable: true,
    })
    expect(rateLimitRetryAfterMs(limited, now)).toBe(9_000)

    const server = Object.assign(new Error("down"), {
      statusCode: 500,
      retryAfterMs: 9_000,
    })
    expect(isRateLimitError(server)).toBe(false)
    expect(rateLimitRetryAfterMs(server, now)).toBeUndefined()

    expect(
      rateLimitRetryAfterMs(
        new MediaRateLimitError("limited", undefined, 1_500),
        now,
      ),
    ).toBe(1_500)
    expect(
      rateLimitRetryAfterMs(new RenderRateLimitError("limited", 2_000), now),
    ).toBe(2_000)
    expect(
      rateLimitRetryAfterMs(new RenderRateLimitError("limited"), now),
    ).toBeUndefined()
  })
})
