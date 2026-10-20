import { APICallError } from "ai"
import {
  MediaAccountError,
  MediaRateLimitError,
  MediaServiceUnavailableError,
  MediaSubmissionUnknownError,
  MediaValidationError,
} from "@/features/media-engine/providers/type"
import { isFailoverError, isUserAbort } from "@/features/ai/llm/errors"
import { TavilyHttpError, TavilyRequestError } from "@/lib/tavily-client"
import { RenderRateLimitError } from "@/features/video-editor/render-client"
import type { ErrorAction } from "./types"

export class SubmissionUnknownError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = "SubmissionUnknownError"
  }
}

function statusOf(error: unknown): number | undefined {
  if (error instanceof APICallError) return error.statusCode
  if (error instanceof TavilyHttpError) return error.status
  if (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  ) {
    return error.statusCode
  }
  return undefined
}

export function classifyLlmError(error: unknown): ErrorAction {
  if (isUserAbort(error)) return "abort"
  const status = statusOf(error)
  if (status === 404) return "route_failure"
  if (status === 400) return "client_failure"
  if (isFailoverError(error)) return "account_failure"
  return "client_failure"
}

export function classifyMediaError(error: unknown): ErrorAction {
  if (isUserAbort(error)) return "abort"
  if (error instanceof MediaSubmissionUnknownError) return "submission_unknown"
  if (error instanceof MediaValidationError) return "client_failure"
  if (
    error instanceof MediaRateLimitError ||
    error instanceof MediaServiceUnavailableError ||
    error instanceof MediaAccountError
  ) {
    return "account_failure"
  }
  return "client_failure"
}

export function classifyWebError(error: unknown): ErrorAction {
  if (isUserAbort(error)) return "abort"
  if (error instanceof TavilyHttpError) {
    const status = error.status
    if (status === 429 || (status != null && status >= 500))
      return "account_failure"
    if (status === 404) return "route_failure"
    return "client_failure"
  }
  if (error instanceof TavilyRequestError || error instanceof TypeError) {
    return "account_failure"
  }
  return "client_failure"
}

export function classifyRenderError(error: unknown): ErrorAction {
  if (isUserAbort(error)) return "abort"
  if (error instanceof SubmissionUnknownError) return "submission_unknown"
  if (error instanceof RenderRateLimitError) return "account_failure"
  const message = error instanceof Error ? error.message : ""
  if (/bad request|cannot be rendered|validation/i.test(message)) {
    return "client_failure"
  }
  if (/429|rate|throttl|concurrency limit/i.test(message))
    return "account_failure"
  if (/timeout|network|econn|fetch failed|503|502/i.test(message)) {
    return "submission_unknown"
  }
  return "account_failure"
}
