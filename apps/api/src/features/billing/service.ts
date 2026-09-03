/**
 * BillingService — public, race-safe two-phase reservation API.
 *
 * Lifecycle: reserve → settle (or refund / expire). All transitions are
 * idempotent via status-guarded UPDATEs in repo.ts.
 */

import * as repo from "./repo"
import type {
  BillingReservation,
  Credits,
  ReserveInput,
  SettleInput,
} from "./types"

export class BillingService {
  /** Sweep in the background; throttled by the caller. */
  private sweepTimer: ReturnType<typeof setInterval> | null = null

  async getBalance(organizationId: string): Promise<bigint> {
    return repo.getBalance(organizationId)
  }

  /**
   * Credit the wallet. Used for top-ups, subscription grants, manual
   * adjustments. `idempotencyKey` must be globally unique for the operation.
   */
  async topup(input: {
    organizationId: string
    amount: Credits
    idempotencyKey: string
    metadata?: Record<string, unknown>
  }): Promise<bigint> {
    return repo.topup(input)
  }

  /**
   * Atomically debit `estimatedCredits` and create a reservation row.
   *
   * Throws `InsufficientCreditsError` if the wallet cannot cover the estimate.
   * Repeated calls with the same `idempotencyKey` return the existing
   * reservation without re-debiting.
   */
  async reserve(input: ReserveInput): Promise<BillingReservation> {
    return repo.reserve(input)
  }

  /**
   * Finalize a reservation with the actual cost. Refunds the difference when
   * `actual < estimated`; debits the difference when `actual > estimated`
   * (clamped to current balance, with any uncovered remainder recorded in the
   * ledger). No-op if the reservation is already settled/refunded/expired.
   */
  async settle(input: SettleInput): Promise<BillingReservation> {
    return repo.settle(input)
  }

  /**
   * Cancel a reservation and refund the full estimate. No-op if the
   * reservation is already in a terminal state.
   */
  async refund(reservationId: string, reason?: string): Promise<void> {
    await repo.refund({ reservationId, reason })
  }

  /**
   * Extend the reservation's TTL. Long-running async pollers should call this
   * when remaining TTL drops below ~20% of the original.
   */
  async extend(
    reservationId: string,
    ttlMs: number,
  ): Promise<BillingReservation> {
    return repo.extend({ reservationId, ttlMs })
  }

  /**
   * Extend a reserved reservation when remaining TTL drops below
   * `thresholdRatio` of the original window (default 20%).
   */
  async renewIfNearExpiry(
    reservationId: string,
    ttlMs: number,
    thresholdRatio = 0.2,
  ): Promise<void> {
    const current = await this.getReservation(reservationId)
    if (!current || current.status !== "reserved") return
    const remainingMs = current.expiresAt.getTime() - Date.now()
    if (remainingMs > ttlMs * thresholdRatio) return
    await this.extend(reservationId, ttlMs)
  }

  /** Refund all expired reservations still in `reserved` state. */
  async sweepExpired(limit = 100): Promise<number> {
    return repo.sweepExpired(limit)
  }

  async getReservation(
    reservationId: string,
  ): Promise<BillingReservation | null> {
    return repo.getReservation(reservationId)
  }

  startSweeper(intervalMs = 60_000, batch = 100): void {
    if (this.sweepTimer) return
    this.sweepTimer = setInterval(() => {
      this.sweepExpired(batch).catch((err) => {
        console.error("[billing] sweep failed", err)
      })
    }, intervalMs)
    // Don't hold the event loop open.
    if (
      typeof this.sweepTimer === "object" &&
      this.sweepTimer &&
      "unref" in this.sweepTimer
    ) {
      ;(this.sweepTimer as { unref?: () => void }).unref?.()
    }
  }

  stopSweeper(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer)
      this.sweepTimer = null
    }
  }
}

export const billingService = new BillingService()
