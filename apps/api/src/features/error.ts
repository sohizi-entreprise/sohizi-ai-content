abstract class BaseError extends Error {
  abstract readonly status: number

  constructor(public message: string) {
    super(message)
    this.name = new.target.name
  }

  toResponse() {
    return Response.json(
      {
        error: this.message,
        code: this.status,
      },
      {
        status: this.status,
      },
    )
  }
}

export class NotFound extends BaseError {
  readonly status = 404
  constructor(message: string = "Not Found") {
    super(message)
  }
}

export class BadRequest extends BaseError {
  readonly status = 400
  constructor(message: string = "Bad Request") {
    super(message)
  }
}

export class Conflict extends BaseError {
  readonly status = 409
  constructor(message: string = "Conflict") {
    super(message)
  }
}

export class Forbidden extends BaseError {
  readonly status = 403
  constructor(message: string = "Forbidden") {
    super(message)
  }
}

export class Unauthorized extends BaseError {
  readonly status = 401
  constructor(message: string = "Unauthorized") {
    super(message)
  }
}

export class TooManyRequests extends BaseError {
  readonly status = 429

  constructor(
    message: string = "Too many requests",
    readonly retryAfterMs = 5_000,
  ) {
    super(message)
  }

  toResponse() {
    return Response.json(
      { error: this.message, code: this.status },
      {
        status: this.status,
        headers: { "Retry-After": String(Math.ceil(this.retryAfterMs / 1000)) },
      },
    )
  }
}

export class InternalServerError extends BaseError {
  readonly status = 500
  constructor(message: string = "Internal Server Error") {
    super(message)
  }
}

type RepositoryErrorType = "NotFound" | "DbError" | "Conflict"

export class RepositoryError extends Error {
  constructor(
    public message: string,
    public type: RepositoryErrorType,
  ) {
    super(message)
    this.name = new.target.name
    this.type = type
  }
}
