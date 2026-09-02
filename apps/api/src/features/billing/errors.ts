import { BadRequest } from '@/features/error'

abstract class BillingError extends Error {
  abstract readonly status: number
  constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
  toResponse() {
    return Response.json(
      { error: this.message, code: this.status },
      { status: this.status },
    )
  }
}

export class InsufficientCreditsError extends BillingError {
  readonly status = 402
  constructor(
    public readonly organizationId: string,
    public readonly requested: bigint,
    public readonly available: bigint,
  ) {
    super(
      `Insufficient credits for organization ${organizationId}: requested ${requested}, available ${available}`,
    )
  }
}

export class ReservationNotFoundError extends BillingError {
  readonly status = 404
  constructor(public readonly reservationId: string) {
    super(`Reservation ${reservationId} not found`)
  }
}

export class ReservationExpiredError extends BillingError {
  readonly status = 409
  constructor(
    public readonly reservationId: string,
    public readonly status_: string,
  ) {
    super(
      `Reservation ${reservationId} is no longer reservable (status=${status_})`,
    )
  }
}

export class BillingTimeoutError extends BillingError {
  readonly status = 504
  constructor(
    public readonly operation: string,
    public readonly timeoutMs: number,
  ) {
    super(`Billable operation '${operation}' timed out after ${timeoutMs}ms`)
  }
}

export class BillableConfigError extends BadRequest {
  constructor(message: string) {
    super(`Billable misconfigured: ${message}`)
  }
}
