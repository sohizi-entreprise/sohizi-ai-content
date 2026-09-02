export type ErrorCode =
  | 'bad_request'
  | 'unauthorized'
  | 'not_found'
  | 'conflict'
  | 'payload_too_large'
  | 'method_not_allowed'
  | 'internal_error'

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  not_found: 404,
  conflict: 409,
  payload_too_large: 413,
  method_not_allowed: 405,
  internal_error: 500,
}

export class HttpError extends Error {
  readonly code: ErrorCode
  readonly details?: unknown

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message)
    this.name = 'HttpError'
    this.code = code
    this.details = details
  }

  get status(): number {
    return STATUS_BY_CODE[this.code]
  }
}

export function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...init?.headers,
    },
  })
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.status },
    )
  }

  // Never leak stack traces or upstream messages to callers.
  console.error('[worker] unhandled error:', error)
  return json(
    {
      error: {
        code: 'internal_error',
        message: 'Unexpected render service error',
      },
    },
    { status: 500 },
  )
}

export function textResponse(
  body: string,
  status: number,
  headers?: HeadersInit,
): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', ...headers },
  })
}
