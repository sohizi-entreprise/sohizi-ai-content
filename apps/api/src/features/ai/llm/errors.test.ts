import { describe, expect, test } from "bun:test"
import { APICallError } from "ai"
import { LlmConfigurationError, isFailoverError } from "./errors"
import { isAbortedByUser } from "../agent/utils/llm-client"

function apiError(statusCode: number, isRetryable: boolean) {
  return new APICallError({
    message: `status ${statusCode}`,
    url: "https://example.com",
    requestBodyValues: {},
    statusCode,
    isRetryable,
  })
}

describe("isFailoverError", () => {
  test("fails over vendor billing, server, and retryable statuses", () => {
    expect(isFailoverError(apiError(402, false))).toBe(true)
    expect(isFailoverError(apiError(408, true))).toBe(true)
    expect(isFailoverError(apiError(409, true))).toBe(true)
    expect(isFailoverError(apiError(429, true))).toBe(true)
    expect(isFailoverError(apiError(500, true))).toBe(true)
    expect(isFailoverError(apiError(500, false))).toBe(true)
    expect(isFailoverError(apiError(529, true))).toBe(true)
  })

  test("keeps client errors on the current vendor", () => {
    expect(isFailoverError(apiError(400, false))).toBe(false)
    expect(isFailoverError(apiError(400, true))).toBe(false)
    expect(isFailoverError(apiError(401, false))).toBe(false)
    expect(isFailoverError(apiError(404, false))).toBe(false)
  })

  test("fails over a retryable error that has no status", () => {
    expect(
      isFailoverError({
        name: "GatewayInternalServerError",
        isRetryable: true,
      }),
    ).toBe(true)
  })

  test("fails over an attempt timeout and not a caller abort", () => {
    expect(isFailoverError(new DOMException("timed out", "TimeoutError"))).toBe(
      true,
    )
    expect(isFailoverError(new DOMException("aborted", "AbortError"))).toBe(
      false,
    )
    expect(
      isFailoverError(new DOMException("aborted", "ResponseAborted")),
    ).toBe(false)
  })

  test("does not fail over a configuration error", () => {
    expect(isFailoverError(new LlmConfigurationError("missing key"))).toBe(
      false,
    )
  })
})

describe("isAbortedByUser", () => {
  test("detects user AbortController cancellation even when downstream throws another error", () => {
    const controller = new AbortController()
    controller.abort()

    expect(
      isAbortedByUser(controller.signal, new Error("No output generated.")),
    ).toBe(true)
  })

  test("does not treat a non-aborted signal with a generic error as a user abort", () => {
    const controller = new AbortController()

    expect(
      isAbortedByUser(controller.signal, new Error("Provider failed")),
    ).toBe(false)
  })

  test("does not treat a TimeoutError reason as a user abort", () => {
    const controller = new AbortController()
    controller.abort(new DOMException("timed out", "TimeoutError"))

    expect(
      isAbortedByUser(
        controller.signal,
        new DOMException("timed out", "TimeoutError"),
      ),
    ).toBe(false)
  })
})
