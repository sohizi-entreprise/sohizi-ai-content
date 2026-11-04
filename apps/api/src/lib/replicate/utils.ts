import {
  MediaAccountError,
  MediaProviderError,
  MediaRateLimitError,
  MediaServiceUnavailableError,
  MediaSubmissionUnknownError,
  MediaValidationError,
} from "@/features/media-engine/providers/type"
import { parseRetryAfterHeader } from "@/features/capacity/retry-after"

export type ReplicatePredictionStatus =
  "starting" | "processing" | "succeeded" | "failed" | "canceled" | "aborted"

export type ReplicatePrediction = {
  id: string
  status: ReplicatePredictionStatus
  output?: unknown
  error?: unknown
  urls?: {
    get?: string
    cancel?: string
  }
}

const KNOWN_PREDICTION_STATUSES = new Set<ReplicatePredictionStatus>([
  "starting",
  "processing",
  "succeeded",
  "failed",
  "canceled",
  "aborted",
])

const REPLICATE_API_BASE = "https://api.replicate.com/v1"

const buildHeader = (
  apiKey: string,
  authOnly: boolean = false,
): HeadersInit => {
  if (authOnly) {
    return {
      Authorization: `Bearer ${apiKey}`,
    }
  }
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  }
}

export const submitJob = async (
  apiKey: string,
  modelId: string,
  input: unknown,
) => {
  const [owner, name, version] = modelId.split("/")
  if (!owner || !name) {
    throw new MediaValidationError(`Invalid Replicate model path: ${modelId}`)
  }

  const url = version
    ? `${REPLICATE_API_BASE}/predictions`
    : `${REPLICATE_API_BASE}/models/${owner}/${name}/predictions`
  const body = version ? { version, input } : { input }

  const result = (await requestJson(
    url,
    {
      method: "POST",
      headers: buildHeader(apiKey),
      body: JSON.stringify(body),
    },
    { ambiguousOnNetwork: true },
  )) as ReplicatePrediction

  if (!result?.id) {
    throw new MediaProviderError("Replicate response is missing prediction id")
  }

  return {
    jobId: result.id,
    status: "created" as const,
    resultUrl: result.urls?.get,
  }
}

export const getJobResult = async (apiKey: string, jobId: string) => {
  const url = `${REPLICATE_API_BASE}/predictions/${encodeURIComponent(jobId)}`
  const result = (await requestJson(url, {
    method: "GET",
    headers: buildHeader(apiKey, true),
  })) as ReplicatePrediction

  const status = result.status
  if (!KNOWN_PREDICTION_STATUSES.has(status)) {
    throw new MediaProviderError(`Unexpected Replicate status: ${status}`, 500)
  }

  if (status === "succeeded") {
    return {
      status: "completed" as const,
      outputs: result.output,
    }
  }

  if (status === "failed") {
    return {
      status: "failed" as const,
      outputs: result.error ?? "Replicate prediction failed",
    }
  }

  if (status === "canceled" || status === "aborted") {
    return {
      status: "cancelled" as const,
      outputs: result.error ?? "Replicate prediction was cancelled",
    }
  }

  return {
    status:
      status === "starting" ? ("created" as const) : ("processing" as const),
    outputs: result.output,
  }
}

export const cancelJob = async (apiKey: string, jobId: string) => {
  const url = `${REPLICATE_API_BASE}/predictions/${encodeURIComponent(jobId)}/cancel`
  const result = (await requestJson(url, {
    method: "POST",
    headers: buildHeader(apiKey, true),
  })) as ReplicatePrediction

  return Boolean(result?.id)
}

function retryAfterMsFrom(
  response: Response,
  errorText: string,
): number | undefined {
  const headerMs = parseRetryAfterHeader(
    response.headers.get("retry-after") ?? "",
  )
  if (headerMs !== undefined) return headerMs

  try {
    const parsed = JSON.parse(errorText) as { retry_after?: unknown }
    if (
      typeof parsed?.retry_after === "number" &&
      Number.isFinite(parsed.retry_after) &&
      parsed.retry_after > 0
    ) {
      return Math.ceil(parsed.retry_after * 1000)
    }
  } catch {
    // ignore non-JSON body
  }
  return undefined
}

function extractErrorDetail(errorText: string, fallback: string): string {
  if (!errorText) return fallback
  try {
    const parsed = JSON.parse(errorText) as {
      detail?: unknown
      title?: unknown
      error?: unknown
    }
    if (typeof parsed.detail === "string" && parsed.detail.trim()) {
      return parsed.detail
    }
    if (typeof parsed.error === "string" && parsed.error.trim()) {
      return parsed.error
    }
    if (typeof parsed.title === "string" && parsed.title.trim()) {
      return parsed.title
    }
  } catch {
    // fall through
  }
  return errorText
}

async function requestJson(
  url: string,
  options: RequestInit = {},
  flags: { ambiguousOnNetwork?: boolean } = {},
) {
  let response: Response
  try {
    response = await fetch(url, options)
  } catch (error) {
    const cause = error instanceof Error ? error : undefined
    const message = cause?.message ?? "Request timed out"
    if (flags.ambiguousOnNetwork) {
      throw new MediaSubmissionUnknownError(message, cause)
    }
    throw new MediaServiceUnavailableError(message, cause)
  }

  if (!response.ok) {
    const status = response.status
    const errorText = await response.text()
    const detail = extractErrorDetail(errorText, response.statusText)

    if (status === 401 || status === 402 || status === 403) {
      throw MediaAccountError.fromResponse(status, detail)
    }
    if (status === 400 || status === 422) {
      throw new MediaValidationError(detail || "Invalid Parameters")
    }
    if (status === 429) {
      throw MediaRateLimitError.fromResponse(
        status,
        detail || "Too Many Requests",
        undefined,
        retryAfterMsFrom(response, errorText),
      )
    }
    if (status >= 500) {
      console.error("Replicate API Error:", errorText)
      throw MediaServiceUnavailableError.fromResponse(
        status,
        detail || "Internal Server Error",
      )
    }
    throw MediaProviderError.fromResponse(status, detail)
  }

  return response.json()
}
