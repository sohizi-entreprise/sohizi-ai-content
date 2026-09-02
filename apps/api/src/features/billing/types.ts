import type {
  BillingReservation,
  BillingLedgerEntry,
  BillingReservationStatus,
  BillingLedgerKind,
} from '@/db/schema'

export type {
  BillingReservation,
  BillingLedgerEntry,
  BillingReservationStatus,
  BillingLedgerKind,
}

export type Credits = bigint

export interface BillableContext {
  organizationId: string
  userId?: string | null
  signal: AbortSignal
  reservationId: string
  metadata?: Record<string, unknown>
}

export interface BillableResult<TOutput> {
  output: TOutput
  actualCredits: Credits
}

/**
 * A Billable describes anything that can be metered and charged.
 *
 * - `timeoutMs` is the wall-clock budget for `execute()`. The wrapper aborts with `BillingTimeoutError`.
 * - `ttlMs` (optional) is the reservation TTL. Defaults to `max(timeoutMs * 4, 30 min)`.
 *   The wrapper enforces `ttlMs >= timeoutMs * 2` at construction time.
 * - `idempotencyKey` must be deterministic for the same logical call.
 */
export interface Billable<TInput, TOutput> {
  operation: string
  timeoutMs: number
  ttlMs?: number
  estimateCost(input: TInput): Credits | Promise<Credits>
  execute(input: TInput, ctx: BillableContext): Promise<BillableResult<TOutput>>
  idempotencyKey(
    input: TInput,
    ctx: {
      organizationId: string
      userId?: string | null
      metadata?: Record<string, unknown>
    },
  ): string
}

/**
 * Streaming billable: produces a stream of chunks. The wrapper reserves
 * up-front, yields chunks unchanged to the caller, and settles when
 * `terminalCredits()` returns a non-null value for a chunk (typically the
 * final usage-bearing chunk). If the stream ends without a terminal chunk or
 * throws, the wrapper refunds.
 */
export interface BillableStream<TInput, TChunk> {
  operation: string
  timeoutMs: number
  ttlMs?: number
  estimateCost(input: TInput): Credits | Promise<Credits>
  stream(
    input: TInput,
    signal: AbortSignal,
  ): AsyncGenerator<TChunk, void, unknown>
  /**
   * Inspect a chunk and, if it carries final usage/cost information, return
   * the actual credits to settle. Return `null` for non-terminal chunks.
   */
  terminalCredits(chunk: TChunk): Credits | null
  idempotencyKey(
    input: TInput,
    ctx: {
      organizationId: string
      userId?: string | null
      metadata?: Record<string, unknown>
    },
  ): string
}

/**
 * Async billable: `execute()` only kicks off the job and returns a handle.
 * The caller persists `reservationId` and later calls `billing.settle(reservationId, actualCredits)`
 * or `billing.refund(reservationId)` from the completion handler.
 */
export interface BillableAsync<TInput, TJobHandle> {
  operation: string
  timeoutMs: number
  ttlMs?: number
  estimateCost(input: TInput): Credits | Promise<Credits>
  submit(input: TInput, ctx: BillableContext): Promise<TJobHandle>
  idempotencyKey(
    input: TInput,
    ctx: {
      organizationId: string
      userId?: string | null
      metadata?: Record<string, unknown>
    },
  ): string
}

export interface ReserveInput {
  organizationId: string
  userId?: string | null
  operation: string
  estimatedCredits: Credits
  ttlMs: number
  idempotencyKey: string
  /** When set, used as the reservation primary key instead of a generated UUID. */
  id?: string
  metadata?: Record<string, unknown>
}

export interface SettleInput {
  reservationId: string
  actualCredits: Credits
  metadata?: Record<string, unknown>
}
