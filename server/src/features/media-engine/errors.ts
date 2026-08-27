/**
 * Custom error classes for media generation.
 * 
 * The `isRetriable` property indicates whether the operation can be retried.
 * Inngest will only retry errors where isRetriable is explicitly true.
 */

export abstract class MediaError extends Error {
    abstract readonly isRetriable: boolean;
    abstract readonly code: string;

    constructor(message: string, public readonly cause?: Error) {
        super(message);
        this.name = this.constructor.name;
        if (cause) {
            this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
        }
    }
}

export class MediaRateLimitError extends MediaError {
    readonly isRetriable = true;
    readonly code = 'RATE_LIMIT';

    constructor(message: string, cause?: Error, public readonly retryAfterMs?: number) {
        super(message || 'Rate limit exceeded. Please retry later.', cause);
    }

    static fromResponse(status: number, statusText: string, cause?: Error, retryAfterMs?: number): MediaRateLimitError {
        return new MediaRateLimitError(`Rate limit exceeded (${status}): ${statusText}`, cause, retryAfterMs);
    }
}

export class MediaServiceUnavailableError extends MediaError {
    readonly isRetriable = true;
    readonly code = 'SERVICE_UNAVAILABLE';

    constructor(message: string, cause?: Error) {
        super(message || 'Service temporarily unavailable. Please retry later.', cause);
    }

    static fromResponse(status: number, statusText: string, cause?: Error): MediaServiceUnavailableError {
        return new MediaServiceUnavailableError(`Service unavailable (${status}): ${statusText}`, cause);
    }
}

export class MediaProviderError extends MediaError {
    readonly isRetriable = false;
    readonly code = 'PROVIDER_ERROR';

    constructor(
        message: string,
        public readonly providerStatus?: number,
        cause?: Error,
    ) {
        super(message, cause);
    }

    static fromResponse(status: number, statusText: string, cause?: Error): MediaProviderError {
        return new MediaProviderError(`Provider error (${status}): ${statusText}`, status, cause);
    }
}

export class MediaValidationError extends MediaError {
    readonly isRetriable = false;
    readonly code = 'VALIDATION_ERROR';

    constructor(message: string, cause?: Error) {
        super(message, cause);
    }
}

export class MediaConfigurationError extends MediaError {
    readonly isRetriable = false;
    readonly code = 'CONFIGURATION_ERROR';

    constructor(message: string, cause?: Error) {
        super(message, cause);
    }
}

export class MediaGenerationFailedError extends MediaError {
    readonly isRetriable = false;
    readonly code = 'GENERATION_FAILED';

    constructor(message: string, cause?: Error) {
        super(message || 'Media generation failed at provider.', cause);
    }
}

export class MediaTimeoutError extends MediaError {
    readonly isRetriable: boolean;
    readonly code = 'TIMEOUT';

    constructor(message: string, isRetriable: boolean = false, cause?: Error) {
        super(message, cause);
        this.isRetriable = isRetriable;
    }
}

/**
 * Determines whether an error from an HTTP response should be retriable,
 * and returns the appropriate MediaError subclass.
 */
export function mediaErrorFromResponse(
    status: number,
    statusText: string,
    context?: string,
): MediaError {
    const prefix = context ? `${context}: ` : '';

    if (status === 429) {
        return MediaRateLimitError.fromResponse(status, statusText);
    }

    if (status === 503 || status === 502 || status === 504) {
        return MediaServiceUnavailableError.fromResponse(status, statusText);
    }

    return MediaProviderError.fromResponse(status, `${prefix}${statusText}`);
}

export type WrapErrorOptions = {
    context?: string;
    status?: number;
}

/**
 * Wraps an unknown error into the appropriate MediaError subclass.
 * 
 * When a status code is provided, it is used as the primary decision maker
 * for determining retriability. Message parsing is only used as a fallback
 * when status is not available (e.g., errors from third-party SDKs).
 */
export function wrapAsMediaError(error: unknown, options?: WrapErrorOptions | string): MediaError {
    if (error instanceof MediaError) {
        return error;
    }

    const opts = typeof options === 'string' ? { context: options } : options ?? {};
    const { context, status } = opts;
    const prefix = context ? `${context}: ` : '';
    const message = error instanceof Error ? error.message : String(error);
    const cause = error instanceof Error ? error : undefined;

    if (status !== undefined) {
        if (status === 429) {
            return new MediaRateLimitError(`${prefix}${message}`, cause);
        }
        if (status === 502 || status === 503 || status === 504) {
            return new MediaServiceUnavailableError(`${prefix}${message}`, cause);
        }
        return new MediaProviderError(`${prefix}${message}`, status, cause);
    }

    if (error instanceof Error) {
        const msg = error.message.toLowerCase();

        if (msg.includes('429') || msg.includes('rate limit') || msg.includes('too many requests')) {
            return new MediaRateLimitError(`${prefix}${error.message}`, error);
        }

        if (msg.includes('503') || msg.includes('502') || msg.includes('504') ||
            msg.includes('service unavailable') || msg.includes('bad gateway') ||
            msg.includes('gateway timeout')) {
            return new MediaServiceUnavailableError(`${prefix}${error.message}`, error);
        }
    }

    return new MediaProviderError(`${prefix}${message}`, undefined, cause);
}

/**
 * Type guard to check if an error is a MediaError with the isRetriable property.
 */
export function isMediaError(error: unknown): error is MediaError {
    return error instanceof MediaError;
}
