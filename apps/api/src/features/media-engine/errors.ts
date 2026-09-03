/**
 * Custom error classes for media generation.
 *
 * The `isRetriable` property indicates whether the operation can be retried.
 * Inngest will only retry errors where isRetriable is explicitly true.
 */

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

/**
 * Type guard to check if an error is a MediaError with the isRetriable property.
 */
export function isMediaError(error: unknown): error is MediaError {
  return error instanceof MediaError
}
