import {
  MediaAccountError,
  MediaProviderError,
  MediaRateLimitError,
  MediaServiceUnavailableError,
  MediaSubmissionUnknownError,
  MediaValidationError,
} from "@/features/media-engine/providers/type"
import { parseRetryAfterHeader } from "@/features/capacity/retry-after"

type SubmitJobResponse = {
  code: number
  message: string
  data: {
    id: string
    status: "created"
    urls: {
      get: string
    }
  }
}

type GetJobResultResponse = {
  status:
    "completed" | "failed" | "cancelled" | "timeout" | "processing" | "created"
  outputs: unknown
  error?: unknown
}

const KNOWN_JOB_STATUSES = new Set([
  "created",
  "processing",
  "completed",
  "failed",
  "cancelled",
  "timeout",
])

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
  const url = `https://api.wavespeed.ai/api/v3/${modelId}`
  const options: RequestInit = {
    method: "POST",
    headers: buildHeader(apiKey),
    body: JSON.stringify(input),
  }
  const result = (await requestJson(url, options, {
    ambiguousOnNetwork: true,
  })) as SubmitJobResponse
  return {
    jobId: result.data.id,
    status: result.data.status,
    resultUrl: result.data.urls.get,
  }
}

export const getJobResult = async (apiKey: string, jobId: string) => {
  const url = `https://api.wavespeed.ai/api/v3/predictions/${jobId}/result`
  const options: RequestInit = {
    method: "GET",
    headers: buildHeader(apiKey, true),
  }
  const result = (await requestJson(url, options)) as {
    data: GetJobResultResponse
  }
  const status = result.data.status

  if (!KNOWN_JOB_STATUSES.has(status)) {
    throw new MediaProviderError(`Unexpected status: ${status}`, 500)
  }

  return {
    status,
    outputs: result.data.outputs,
    error: result.data.error,
  }
}

export const deleteJob = async (apiKey: string, jobIds: string[]) => {
  const url = `https://api.wavespeed.ai/api/v3/predictions/delete`
  const options: RequestInit = {
    method: "POST",
    headers: buildHeader(apiKey, true),
    body: JSON.stringify({ ids: jobIds }),
  }
  const result = (await requestJson(url, options)) as {
    data: { deleted_count: number }
  }
  return result.data.deleted_count
}

export const getInferencePrice = async (
  apiKey: string,
  modelId: string,
  input: unknown,
) => {
  const url = `https://api.wavespeed.ai/api/v3/model/price`
  const options = {
    method: "POST",
    headers: buildHeader(apiKey),
    body: JSON.stringify({ model_id: modelId, inputs: input }),
  }
  const result = (await requestJson(url, options)) as {
    data: { price: number; currency: "USD" }
  }
  return {
    price: result.data.price,
    currency: result.data.currency,
  }
}

function retryAfterMsFrom(response: Response): number | undefined {
  return parseRetryAfterHeader(response.headers.get("retry-after") ?? "")
}

function extractErrorDetail(errorText: string, fallback: string): string {
  if (!errorText) return fallback
  try {
    const parsed = JSON.parse(errorText) as {
      message?: unknown
      detail?: unknown
      error?: unknown
      data?: { error?: unknown; message?: unknown }
    }
    if (typeof parsed.data?.error === "string" && parsed.data.error.trim()) {
      return parsed.data.error
    }
    if (
      typeof parsed.data?.message === "string" &&
      parsed.data.message.trim()
    ) {
      return parsed.data.message
    }
    if (typeof parsed.error === "string" && parsed.error.trim()) {
      return parsed.error
    }
    if (typeof parsed.detail === "string" && parsed.detail.trim()) {
      return parsed.detail
    }
    if (typeof parsed.message === "string" && parsed.message.trim()) {
      return parsed.message
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
    const error = await response.text()
    const detail = extractErrorDetail(error, response.statusText)
    if (status === 401) {
      throw MediaAccountError.fromResponse(status, detail || "Invalid API Key")
    }
    if (status === 400 || status === 422) {
      throw new MediaValidationError(detail || "Invalid Parameters")
    }
    if (status === 429) {
      throw MediaRateLimitError.fromResponse(
        status,
        detail || "Too Many Requests",
        undefined,
        retryAfterMsFrom(response),
      )
    }
    if (status >= 500) {
      console.error("WaveSpeed API Error:", error)
      throw MediaServiceUnavailableError.fromResponse(
        status,
        detail || "Internal Server Error",
      )
    }
    throw MediaProviderError.fromResponse(status, detail)
  }
  return response.json()
}
