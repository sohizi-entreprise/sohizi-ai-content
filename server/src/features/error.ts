
abstract class BaseError extends Error {
	abstract readonly status: number

	constructor(public message: string) {
		super(message)
        this.name = new.target.name
	}

	toResponse() {
		return Response.json({
			error: this.message,
			code: this.status
		}, {
			status: this.status
		})
	}
}


export class NotFound extends BaseError {
    readonly status = 404
	constructor(message: string = 'Not Found') {
		super(message)
	}
}

export class BadRequest extends BaseError {
    readonly status = 400
	constructor(message: string = 'Bad Request') {
		super(message)
	}
}

export class Forbidden extends BaseError {
    readonly status = 403
	constructor(message: string = 'Forbidden') {
		super(message)
	}
}

export class Unauthorized extends BaseError {
    readonly status = 401
	constructor(message: string = 'Unauthorized') {
		super(message)
	}
}

export class InternalServerError extends BaseError {
    readonly status = 500
	constructor(message: string = 'Internal Server Error') {
		super(message)
	}
}

type RepositoryErrorType = 'NotFound' | 'DbError'

export class RepositoryError extends Error {
	constructor(public message: string, public type: RepositoryErrorType) {
		super(message)
        this.name = new.target.name
		this.type = type
	}
}