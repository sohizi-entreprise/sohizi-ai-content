type RequestStatus =
  "completed" | "failed" | "cancelled" | "timeout" | "processing" | "created"
type Primitive = string | number | boolean | null | undefined
export type SubmitPayload = Record<string, Primitive | Primitive[]>

export type SubmitResponse = {
  requestId: string
  status: "created"
}

type RequestData = Array<string | Record<string, string>>

export type GetRequestDataResponse =
  | {
      status: Omit<RequestStatus, "completed" | "error">
    }
  | {
      status: "completed"
      data: RequestData
    }
  | {
      status: "error"
      error: string
    }

export type CancelResponse = {
  requestId: string
  ok: boolean
}

export type EstimateRequestPriceResponse =
  | {
      ok: true
      priceUSD: number
    }
  | {
      ok: false
      error: string
    }

export abstract class MediaError extends Error {
  abstract readonly isRetriable: boolean
  abstract readonly code: string

  constructor(
    message: string,
    public readonly cause?: Error,
  ) {
    super(message)
    this.name = this.constructor.name
    if (cause) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`
    }
  }
}

export class MediaRateLimitError extends MediaError {
  readonly isRetriable = true
  readonly code = "RATE_LIMIT"

  constructor(
    message: string,
    cause?: Error,
    public readonly retryAfterMs?: number,
  ) {
    super(message || "Rate limit exceeded. Please retry later.", cause)
  }

  static fromResponse(
    status: number,
    statusText: string,
    cause?: Error,
    retryAfterMs?: number,
  ): MediaRateLimitError {
    return new MediaRateLimitError(
      `Rate limit exceeded (${status}): ${statusText}`,
      cause,
      retryAfterMs,
    )
  }
}

export class MediaServiceUnavailableError extends MediaError {
  readonly isRetriable = true
  readonly code = "SERVICE_UNAVAILABLE"

  constructor(message: string, cause?: Error) {
    super(
      message || "Service temporarily unavailable. Please retry later.",
      cause,
    )
  }

  static fromResponse(
    status: number,
    statusText: string,
    cause?: Error,
  ): MediaServiceUnavailableError {
    return new MediaServiceUnavailableError(
      `Service unavailable (${status}): ${statusText}`,
      cause,
    )
  }
}

export class MediaAccountError extends MediaError {
  readonly isRetriable = true
  readonly code = "ACCOUNT_ERROR"

  constructor(message: string, cause?: Error) {
    super(message || "Vendor account is unavailable.", cause)
  }

  static fromResponse(
    status: number,
    statusText: string,
    cause?: Error,
  ): MediaAccountError {
    return new MediaAccountError(
      `Account error (${status}): ${statusText}`,
      cause,
    )
  }
}

export class MediaProviderError extends MediaError {
  readonly isRetriable = false
  readonly code = "PROVIDER_ERROR"

  constructor(
    message: string,
    public readonly providerStatus?: number,
    cause?: Error,
  ) {
    super(message, cause)
  }

  static fromResponse(
    status: number,
    statusText: string,
    cause?: Error,
  ): MediaProviderError {
    return new MediaProviderError(
      `Provider error (${status}): ${statusText}`,
      status,
      cause,
    )
  }
}

export class MediaValidationError extends MediaError {
  readonly isRetriable = false
  readonly code = "VALIDATION_ERROR"

  constructor(message: string, cause?: Error) {
    super(message, cause)
  }
}

export class MediaConfigurationError extends MediaError {
  readonly isRetriable = false
  readonly code = "CONFIGURATION_ERROR"

  constructor(message: string, cause?: Error) {
    super(message, cause)
  }
}

export function isMediaError(error: unknown): error is MediaError {
  return error instanceof MediaError
}

export interface MediaEngineProvider {
  submitRequest: (
    model: string,
    payload: SubmitPayload,
  ) => Promise<SubmitResponse>
  getRequestData: (requestId: string) => Promise<GetRequestDataResponse>
  cancelRequest: (requestId: string) => Promise<CancelResponse>
  estimateRequestPrice: (
    model: string,
    payload: SubmitPayload,
  ) => Promise<EstimateRequestPriceResponse>
}
