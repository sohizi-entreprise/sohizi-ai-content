/**
 * Wrappers that turn a `Billable` / `BillableAsync` into a callable that
 * goes through the full reserve → execute → settle / refund lifecycle.
 *
 * Both wrappers enforce `ttlMs >= timeoutMs * 2` so that the sweeper cannot
 * race ahead of a legitimate in-flight execution (G1 in the design doc).
 */

import type {
  Billable,
  BillableAsync,
  BillableContext,
  BillableResult,
  BillableStream,
  Credits,
} from './types'
import { BillingService } from './service'
import { BillableConfigError, BillingTimeoutError } from './errors'

const THIRTY_MINUTES_MS = 30 * 60 * 1000

function resolveTtl(timeoutMs: number, ttlMs?: number): number {
  const resolved = ttlMs ?? Math.max(timeoutMs * 4, THIRTY_MINUTES_MS)
  if (resolved < timeoutMs * 2) {
    throw new BillableConfigError(
      `ttlMs (${resolved}ms) must be at least 2x timeoutMs (${timeoutMs}ms) to leave headroom for execution before the sweeper runs`,
    )
  }
  return resolved
}

export interface WithBillingCallContext {
  organizationId: string
  userId?: string | null
  metadata?: Record<string, unknown>
  /**
   * Optional external abort signal. When aborted, the in-flight `execute` /
   * `stream` / `submit` is cancelled and the reservation is refunded.
   * The wrapper still enforces its own timeout independently.
   */
  signal?: AbortSignal
}

/**
 * Combine the wrapper's internal timeout controller with an optional
 * caller-provided abort signal. Returns the combined signal plus a teardown.
 */
function combineSignals(
  timeoutSignal: AbortSignal,
  external?: AbortSignal,
): {
  signal: AbortSignal
  cleanup: () => void
} {
  if (!external) return { signal: timeoutSignal, cleanup: () => {} }
  if (
    typeof (
      AbortSignal as unknown as { any?: (sigs: AbortSignal[]) => AbortSignal }
    ).any === 'function'
  ) {
    const any = (
      AbortSignal as unknown as { any: (sigs: AbortSignal[]) => AbortSignal }
    ).any
    return { signal: any([timeoutSignal, external]), cleanup: () => {} }
  }
  // Fallback for older runtimes.
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  if (external.aborted) controller.abort()
  else external.addEventListener('abort', onAbort, { once: true })
  if (timeoutSignal.aborted) controller.abort()
  else timeoutSignal.addEventListener('abort', onAbort, { once: true })
  return {
    signal: controller.signal,
    cleanup: () => {
      external.removeEventListener('abort', onAbort)
      timeoutSignal.removeEventListener('abort', onAbort)
    },
  }
}

export interface AsyncReservationHandle<TJobHandle> {
  reservationId: string
  jobHandle: TJobHandle
  /**
   * Re-extend the reservation if its remaining TTL has dropped below the
   * configured threshold (default 20% of `ttlMs`). Safe to call in a tight
   * poll loop — it is a no-op when extension is not needed.
   */
  renewIfNearExpiry: (opts?: { thresholdRatio?: number }) => Promise<void>
}

/**
 * Synchronous wrapper: reserve → execute → settle (or refund on error/timeout).
 *
 * The wrapper passes an `AbortSignal` to `execute`. After `timeoutMs` it
 * aborts and refunds the reservation. The original error (or
 * `BillingTimeoutError`) is rethrown.
 */
export function withBilling<TInput, TOutput>(
  billable: Billable<TInput, TOutput>,
  billing: BillingService,
) {
  const ttlMs = resolveTtl(billable.timeoutMs, billable.ttlMs)

  return async function callBillable(
    input: TInput,
    ctx: WithBillingCallContext,
  ): Promise<TOutput> {
    const estimatedCredits = BigInt(await billable.estimateCost(input))
    const idempotencyKey = billable.idempotencyKey(input, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      metadata: ctx.metadata,
    })

    const reservation = await billing.reserve({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      operation: billable.operation,
      estimatedCredits,
      ttlMs,
      idempotencyKey,
      metadata: ctx.metadata,
    })

    if (reservation.status !== 'reserved') {
      throw new BillableConfigError(
        `Idempotency replay: reservation ${reservation.id} is already ${reservation.status}`,
      )
    }

    const controller = new AbortController()
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, billable.timeoutMs)
    const combined = combineSignals(controller.signal, ctx.signal)

    const billCtx: BillableContext = {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      signal: combined.signal,
      reservationId: reservation.id,
      metadata: ctx.metadata,
    }

    let result: BillableResult<TOutput>
    try {
      result = await billable.execute(input, billCtx)
    } catch (err) {
      clearTimeout(timeout)
      combined.cleanup()
      await safeRefund(
        billing,
        reservation.id,
        timedOut ? 'timeout' : 'execute-error',
      )
      if (timedOut) {
        throw new BillingTimeoutError(billable.operation, billable.timeoutMs)
      }
      throw err
    }
    clearTimeout(timeout)
    combined.cleanup()

    await billing.settle({
      reservationId: reservation.id,
      actualCredits: BigInt(result.actualCredits),
      metadata: ctx.metadata,
    })
    return result.output
  }
}

/**
 * Async wrapper: reserve → submit (kick off external job) → return handle.
 *
 * The caller is responsible for invoking `billing.settle(reservationId, ...)`
 * or `billing.refund(reservationId)` when the job completes (e.g. from an
 * Inngest completion step). Long polls should call `renewIfNearExpiry()` each
 * tick to mitigate the "late settle after expiry" failure mode.
 */
export function withBillingAsync<TInput, TJobHandle>(
  billable: BillableAsync<TInput, TJobHandle>,
  billing: BillingService,
) {
  const ttlMs = resolveTtl(billable.timeoutMs, billable.ttlMs)

  return async function startBillable(
    input: TInput,
    ctx: WithBillingCallContext,
  ): Promise<AsyncReservationHandle<TJobHandle>> {
    const estimatedCredits = BigInt(await billable.estimateCost(input))
    const idempotencyKey = billable.idempotencyKey(input, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      metadata: ctx.metadata,
    })

    const reservation = await billing.reserve({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      operation: billable.operation,
      estimatedCredits,
      ttlMs,
      idempotencyKey,
      metadata: ctx.metadata,
    })

    if (reservation.status !== 'reserved') {
      throw new BillableConfigError(
        `Idempotency replay: reservation ${reservation.id} is already ${reservation.status}`,
      )
    }

    const controller = new AbortController()
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, billable.timeoutMs)
    const combined = combineSignals(controller.signal, ctx.signal)

    const billCtx: BillableContext = {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      signal: combined.signal,
      reservationId: reservation.id,
      metadata: ctx.metadata,
    }

    let jobHandle: TJobHandle
    try {
      jobHandle = await billable.submit(input, billCtx)
    } catch (err) {
      clearTimeout(timeout)
      combined.cleanup()
      await safeRefund(
        billing,
        reservation.id,
        timedOut ? 'submit-timeout' : 'submit-error',
      )
      if (timedOut)
        throw new BillingTimeoutError(billable.operation, billable.timeoutMs)
      throw err
    }
    clearTimeout(timeout)
    combined.cleanup()

    const renewIfNearExpiry = async (opts?: { thresholdRatio?: number }) => {
      await billing.renewIfNearExpiry(
        reservation.id,
        ttlMs,
        opts?.thresholdRatio,
      )
    }

    return { reservationId: reservation.id, jobHandle, renewIfNearExpiry }
  }
}

/**
 * Streaming wrapper: reserve → stream chunks → settle on terminal chunk
 * (refund on error / abort / stream ending without a terminal chunk).
 *
 * The returned function is itself an async generator so the caller can
 * `yield*` it from their own generator and forward chunks downstream in
 * real time. Settle / refund happen transparently — the caller never sees
 * the billing lifecycle.
 */
export function withBillingStream<TInput, TChunk>(
  billable: BillableStream<TInput, TChunk>,
  billing: BillingService,
) {
  const ttlMs = resolveTtl(billable.timeoutMs, billable.ttlMs)

  return async function* callBillable(
    input: TInput,
    ctx: WithBillingCallContext,
  ): AsyncGenerator<TChunk, void, unknown> {
    const estimatedCredits = BigInt(await billable.estimateCost(input))
    const idempotencyKey = billable.idempotencyKey(input, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      metadata: ctx.metadata,
    })

    const reservation = await billing.reserve({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      operation: billable.operation,
      estimatedCredits,
      ttlMs,
      idempotencyKey,
      metadata: ctx.metadata,
    })

    if (reservation.status !== 'reserved') {
      throw new BillableConfigError(
        `Idempotency replay: reservation ${reservation.id} is already ${reservation.status}`,
      )
    }

    const controller = new AbortController()
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, billable.timeoutMs)
    const combined = combineSignals(controller.signal, ctx.signal)

    let settled = false
    try {
      for await (const chunk of billable.stream(input, combined.signal)) {
        const actual = billable.terminalCredits(chunk)
        if (actual !== null && !settled) {
          await billing.settle({
            reservationId: reservation.id,
            actualCredits: BigInt(actual),
            metadata: ctx.metadata,
          })
          settled = true
        }
        yield chunk
      }
      if (!settled) {
        // Stream ended without a terminal chunk -- release the reservation
        // immediately rather than waiting for the sweeper.
        await safeRefund(billing, reservation.id, 'stream-no-terminal-chunk')
      }
    } catch (err) {
      if (!settled) {
        await safeRefund(
          billing,
          reservation.id,
          timedOut ? 'stream-timeout' : 'stream-error',
        )
      }
      if (timedOut) {
        throw new BillingTimeoutError(billable.operation, billable.timeoutMs)
      }
      throw err
    } finally {
      clearTimeout(timeout)
      combined.cleanup()
    }
  }
}

export async function safeRefund(
  billing: BillingService,
  reservationId: string | undefined | null,
  reason: string,
) {
  if (!reservationId) return
  try {
    await billing.refund(reservationId, reason)
  } catch (err) {
    console.error(
      '[billing] refund after failure also failed',
      reservationId,
      err,
    )
  }
}

export type { Credits }
