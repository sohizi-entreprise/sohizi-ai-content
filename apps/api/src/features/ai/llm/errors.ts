import { APICallError } from "ai"

// A vendor's exhausted balance is specific to that vendor, so try another route.
const FAILOVER_STATUS = new Set([402, 408, 409, 429])

export class LlmConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "LlmConfigurationError"
  }
}

export class AllLlmVendorsUnavailableError extends Error {
  readonly retryAfterMs: number

  constructor(modelId: string, retryAfterMs: number, cause?: unknown) {
    const detail = cause instanceof Error ? `: ${cause.message}` : ""
    super(
      `No LLM vendor available for ${modelId}${detail}. Retry after ${retryAfterMs}ms.`,
    )
    this.name = "AllLlmVendorsUnavailableError"
    this.retryAfterMs = retryAfterMs
    this.cause = cause
  }
}

function errorName(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined
  const name = (error as { name?: unknown }).name
  return typeof name === "string" ? name : undefined
}

function isGatewayRateLimit(error: unknown): boolean {
  return errorName(error) === "GatewayRateLimitError"
}

export function isUserAbort(error: unknown): boolean {
  const name = errorName(error)
  return name === "AbortError" || name === "ResponseAborted"
}

function isTimeoutError(error: unknown): boolean {
  return errorName(error) === "TimeoutError"
}

function isFailoverStatus(status: number): boolean {
  return FAILOVER_STATUS.has(status) || status >= 500
}

function isRetryableFlag(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { isRetryable?: unknown }).isRetryable === true
  )
}

function statusCodeOf(error: unknown, depth = 0): number | undefined {
  if (!error || typeof error !== "object" || depth > 5) return undefined
  if (
    "statusCode" in error &&
    typeof (error as { statusCode?: unknown }).statusCode === "number"
  ) {
    return (error as { statusCode: number }).statusCode
  }
  if (error instanceof Error && error.cause) {
    return statusCodeOf(error.cause, depth + 1)
  }
  return undefined
}

export function isFailoverError(error: unknown, depth = 0): boolean {
  if (depth > 5 || !error || typeof error !== "object") return false
  if (error instanceof LlmConfigurationError) return false
  if (isUserAbort(error)) return false
  if (isGatewayRateLimit(error)) return true
  if (isTimeoutError(error)) return true

  const status = statusCodeOf(error)
  if (status != null) return isFailoverStatus(status)

  if (error instanceof APICallError && error.isRetryable) return true
  if (isRetryableFlag(error)) return true
  if (error instanceof TypeError) return true

  const message = error instanceof Error ? error.message : ""
  if (
    /fetch failed|network|ECONNRESET|ECONNREFUSED|ETIMEDOUT|socket hang up/i.test(
      message,
    )
  ) {
    return true
  }

  if (error instanceof Error && error.cause) {
    return isFailoverError(error.cause, depth + 1)
  }
  return false
}

export { retryAfterMsFrom } from "@/features/capacity/retry-after"
