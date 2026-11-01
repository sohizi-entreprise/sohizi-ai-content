import { MediaRateLimitError } from "@/features/media-engine/providers/type"

const MAX_DEPTH = 5

function positiveMs(value: number): number | undefined {
  if (!Number.isFinite(value) || value <= 0) return undefined
  return value
}

export function parseRetryAfterHeader(
  raw: string,
  now = Date.now(),
): number | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  const seconds = Number(trimmed)
  if (Number.isFinite(seconds)) return positiveMs(seconds * 1000)
  const date = Date.parse(trimmed)
  if (!Number.isFinite(date)) return undefined
  return positiveMs(date - now)
}

function headerValue(headers: unknown): string | undefined {
  if (!headers) return undefined
  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    return headers.get("retry-after") ?? undefined
  }
  if (typeof headers !== "object") return undefined
  const record = headers as Record<string, unknown>
  const raw =
    record["retry-after"] ?? record["Retry-After"] ?? record["Retry-after"]
  if (typeof raw === "string") return raw
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0]
  return undefined
}

function ownRetryAfterMs(error: object, now: number): number | undefined {
  if ("retryAfterMs" in error && typeof error.retryAfterMs === "number") {
    return positiveMs(error.retryAfterMs)
  }

  const direct = headerValue(
    "responseHeaders" in error ? error.responseHeaders : undefined,
  )
  if (direct) return parseRetryAfterHeader(direct, now)

  if ("headers" in error) {
    const headers = headerValue(error.headers)
    if (headers) return parseRetryAfterHeader(headers, now)
  }

  if (
    "$response" in error &&
    error.$response &&
    typeof error.$response === "object" &&
    "headers" in error.$response
  ) {
    const headers = headerValue(error.$response.headers)
    if (headers) return parseRetryAfterHeader(headers, now)
  }

  return undefined
}

export function retryAfterMsFrom(
  error: unknown,
  now = Date.now(),
  depth = 0,
): number | undefined {
  if (!error || typeof error !== "object" || depth > MAX_DEPTH) return undefined
  const direct = ownRetryAfterMs(error, now)
  if (direct != null) return direct
  if (error instanceof Error && error.cause) {
    return retryAfterMsFrom(error.cause, now, depth + 1)
  }
  return undefined
}

function statusOf(error: object): number | undefined {
  if ("statusCode" in error && typeof error.statusCode === "number") {
    return error.statusCode
  }
  if ("status" in error && typeof error.status === "number") {
    return error.status
  }
  if (
    "$metadata" in error &&
    error.$metadata &&
    typeof error.$metadata === "object" &&
    "httpStatusCode" in error.$metadata &&
    typeof error.$metadata.httpStatusCode === "number"
  ) {
    return error.$metadata.httpStatusCode
  }
  return undefined
}

export function isRateLimitError(error: unknown, depth = 0): boolean {
  if (!error || typeof error !== "object" || depth > MAX_DEPTH) return false
  if (error instanceof MediaRateLimitError) return true
  const name =
    "name" in error && typeof error.name === "string" ? error.name : ""
  if (
    name === "GatewayRateLimitError" ||
    name === "TooManyRequestsException" ||
    name === "RenderRateLimitError"
  ) {
    return true
  }
  if (statusOf(error) === 429) return true
  if (error instanceof Error && error.cause) {
    return isRateLimitError(error.cause, depth + 1)
  }
  return false
}

/** A positive provider hint for a 429. Missing means the registry cooldown applies. */
export function rateLimitRetryAfterMs(
  error: unknown,
  now = Date.now(),
): number | undefined {
  if (!isRateLimitError(error)) return undefined
  return retryAfterMsFrom(error, now)
}
