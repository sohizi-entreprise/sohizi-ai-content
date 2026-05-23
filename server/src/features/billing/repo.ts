/**
 * Billing repository.
 *
 * Concurrency / isolation notes:
 * - Assumes Postgres default isolation (READ COMMITTED). Under READ COMMITTED,
 *   `UPDATE ... WHERE balance >= $1` re-evaluates the WHERE clause after the row
 *   lock is acquired (EvalPlanQual), so the check-and-debit is atomic without
 *   SELECT FOR UPDATE.
 * - Every wallet balance mutation happens in the same transaction as the
 *   corresponding ledger insert and reservation transition.
 * - Reservation transitions are status-guarded (`WHERE status = 'reserved'`),
 *   so duplicate settle/refund/expire calls become no-ops.
 */

import { db } from '@/db'
import { organizationWallets, billingReservations, billingLedger } from '@/db/schema'
import type { BillingReservation, BillingLedgerKind } from '@/db/schema'
import { sql, eq, and, lt } from 'drizzle-orm'
import {
  InsufficientCreditsError,
  ReservationExpiredError,
  ReservationNotFoundError,
} from './errors'
import type { Credits } from './types'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
type Executor = typeof db | Tx

const ledgerKey = (reservationId: string, kind: BillingLedgerKind, suffix?: string) =>
  suffix ? `${reservationId}:${kind}:${suffix}` : `${reservationId}:${kind}`

async function ensureWallet(orgId: string, tx: Executor): Promise<void> {
  await tx
    .insert(organizationWallets)
    .values({ organizationId: orgId, balance: 0n })
    .onConflictDoNothing()
}

async function getBalanceRaw(orgId: string, tx: Executor): Promise<bigint> {
  const rows = await tx
    .select({ balance: organizationWallets.balance })
    .from(organizationWallets)
    .where(eq(organizationWallets.organizationId, orgId))
    .limit(1)
  return rows[0]?.balance ?? 0n
}

export async function getBalance(orgId: string): Promise<bigint> {
  return getBalanceRaw(orgId, db)
}

export async function topup(input: {
  organizationId: string
  amount: Credits
  idempotencyKey: string
  metadata?: Record<string, unknown>
}): Promise<bigint> {
  if (input.amount <= 0n) throw new Error('topup amount must be positive')
  return db.transaction(async (tx) => {
    await ensureWallet(input.organizationId, tx)
    const updated = await tx
      .update(organizationWallets)
      .set({ balance: sql`${organizationWallets.balance} + ${input.amount}` })
      .where(eq(organizationWallets.organizationId, input.organizationId))
      .returning({ balance: organizationWallets.balance })
    const balanceAfter = updated[0].balance
    await tx.insert(billingLedger).values({
      reservationId: null,
      organizationId: input.organizationId,
      delta: input.amount,
      kind: 'topup',
      balanceAfter,
      idempotencyKey: input.idempotencyKey,
      metadata: input.metadata ?? null,
    })
    return balanceAfter
  })
}

export interface ReserveRow extends BillingReservation {
  /** true if a brand-new reservation was created in this call. */
  created: boolean
}

export async function reserve(input: {
  organizationId: string
  userId?: string | null
  operation: string
  estimatedCredits: Credits
  ttlMs: number
  idempotencyKey: string
  metadata?: Record<string, unknown>
}): Promise<ReserveRow> {
  if (input.estimatedCredits < 0n) throw new Error('estimatedCredits must be >= 0')
  const expiresAt = new Date(Date.now() + input.ttlMs)

  return db.transaction(async (tx) => {
    await ensureWallet(input.organizationId, tx)

    // Try to claim the idempotency key first. If another tx has already inserted
    // the same key, ON CONFLICT DO NOTHING returns no row; we then read and
    // return the existing reservation without debiting again.
    const inserted = await tx
      .insert(billingReservations)
      .values({
        idempotencyKey: input.idempotencyKey,
        organizationId: input.organizationId,
        userId: input.userId ?? null,
        operation: input.operation,
        estimatedCredits: input.estimatedCredits,
        status: 'reserved',
        expiresAt,
        metadata: input.metadata ?? null,
      })
      .onConflictDoNothing({ target: billingReservations.idempotencyKey })
      .returning()

    if (inserted.length === 0) {
      const existing = await tx
        .select()
        .from(billingReservations)
        .where(eq(billingReservations.idempotencyKey, input.idempotencyKey))
        .limit(1)
      if (!existing[0]) {
        throw new Error('Reservation insert returned no row but no existing row found')
      }
      return { ...existing[0], created: false }
    }

    const reservation = inserted[0]

    if (input.estimatedCredits > 0n) {
      const debited = await tx
        .update(organizationWallets)
        .set({ balance: sql`${organizationWallets.balance} - ${input.estimatedCredits}` })
        .where(
          and(
            eq(organizationWallets.organizationId, input.organizationId),
            sql`${organizationWallets.balance} >= ${input.estimatedCredits}`,
          ),
        )
        .returning({ balance: organizationWallets.balance })

      if (debited.length === 0) {
        const current = await getBalanceRaw(input.organizationId, tx)
        throw new InsufficientCreditsError(
          input.organizationId,
          input.estimatedCredits,
          current,
        )
      }

      await tx.insert(billingLedger).values({
        reservationId: reservation.id,
        organizationId: input.organizationId,
        delta: -input.estimatedCredits,
        kind: 'reserve',
        balanceAfter: debited[0].balance,
        idempotencyKey: ledgerKey(reservation.id, 'reserve'),
        metadata: input.metadata ?? null,
      })
    } else {
      const balance = await getBalanceRaw(input.organizationId, tx)
      await tx.insert(billingLedger).values({
        reservationId: reservation.id,
        organizationId: input.organizationId,
        delta: 0n,
        kind: 'reserve',
        balanceAfter: balance,
        idempotencyKey: ledgerKey(reservation.id, 'reserve'),
        metadata: input.metadata ?? null,
      })
    }

    return { ...reservation, created: true }
  })
}

export async function settle(input: {
  reservationId: string
  actualCredits: Credits
  metadata?: Record<string, unknown>
}): Promise<BillingReservation> {
  if (input.actualCredits < 0n) throw new Error('actualCredits must be >= 0')

  return db.transaction(async (tx) => {
    const updated = await tx
      .update(billingReservations)
      .set({ status: 'settled', actualCredits: input.actualCredits })
      .where(
        and(
          eq(billingReservations.id, input.reservationId),
          eq(billingReservations.status, 'reserved'),
        ),
      )
      .returning()

    if (updated.length === 0) {
      const current = await tx
        .select()
        .from(billingReservations)
        .where(eq(billingReservations.id, input.reservationId))
        .limit(1)
      if (!current[0]) throw new ReservationNotFoundError(input.reservationId)
      throw new ReservationExpiredError(input.reservationId, current[0].status)
    }

    const reservation = updated[0]
    const diff = reservation.estimatedCredits - input.actualCredits

    if (diff > 0n) {
      const credited = await tx
        .update(organizationWallets)
        .set({ balance: sql`${organizationWallets.balance} + ${diff}` })
        .where(eq(organizationWallets.organizationId, reservation.organizationId))
        .returning({ balance: organizationWallets.balance })
      await tx.insert(billingLedger).values({
        reservationId: reservation.id,
        organizationId: reservation.organizationId,
        delta: diff,
        kind: 'settle_diff',
        balanceAfter: credited[0].balance,
        idempotencyKey: ledgerKey(reservation.id, 'settle_diff'),
        metadata: input.metadata ?? null,
      })
    } else if (diff < 0n) {
      const owed = -diff
      const debited = await tx
        .update(organizationWallets)
        .set({ balance: sql`${organizationWallets.balance} - ${owed}` })
        .where(
          and(
            eq(organizationWallets.organizationId, reservation.organizationId),
            sql`${organizationWallets.balance} >= ${owed}`,
          ),
        )
        .returning({ balance: organizationWallets.balance })

      if (debited.length > 0) {
        await tx.insert(billingLedger).values({
          reservationId: reservation.id,
          organizationId: reservation.organizationId,
          delta: -owed,
          kind: 'settle_diff',
          balanceAfter: debited[0].balance,
          idempotencyKey: ledgerKey(reservation.id, 'settle_diff'),
          metadata: input.metadata ?? null,
        })
      } else {
        // Balance insufficient to cover overage. Debit down to 0 and record
        // the uncovered remainder so we never let the wallet go negative.
        const current = await getBalanceRaw(reservation.organizationId, tx)
        if (current > 0n) {
          const drained = await tx
            .update(organizationWallets)
            .set({ balance: 0n })
            .where(eq(organizationWallets.organizationId, reservation.organizationId))
            .returning({ balance: organizationWallets.balance })
          await tx.insert(billingLedger).values({
            reservationId: reservation.id,
            organizationId: reservation.organizationId,
            delta: -current,
            kind: 'settle_diff',
            balanceAfter: drained[0].balance,
            idempotencyKey: ledgerKey(reservation.id, 'settle_diff'),
            metadata: input.metadata ?? null,
          })
        }
        const uncovered = owed - current
        await tx.insert(billingLedger).values({
          reservationId: reservation.id,
          organizationId: reservation.organizationId,
          delta: 0n,
          kind: 'overage_uncovered',
          balanceAfter: 0n,
          idempotencyKey: ledgerKey(reservation.id, 'overage_uncovered'),
          metadata: { ...(input.metadata ?? {}), uncovered: uncovered.toString() },
        })
      }
    }

    return reservation
  })
}

export async function refund(input: {
  reservationId: string
  reason?: string
}): Promise<BillingReservation | null> {
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(billingReservations)
      .set({ status: 'refunded' })
      .where(
        and(
          eq(billingReservations.id, input.reservationId),
          eq(billingReservations.status, 'reserved'),
        ),
      )
      .returning()

    if (updated.length === 0) return null

    const reservation = updated[0]
    if (reservation.estimatedCredits > 0n) {
      const credited = await tx
        .update(organizationWallets)
        .set({ balance: sql`${organizationWallets.balance} + ${reservation.estimatedCredits}` })
        .where(eq(organizationWallets.organizationId, reservation.organizationId))
        .returning({ balance: organizationWallets.balance })
      await tx.insert(billingLedger).values({
        reservationId: reservation.id,
        organizationId: reservation.organizationId,
        delta: reservation.estimatedCredits,
        kind: 'refund',
        balanceAfter: credited[0].balance,
        idempotencyKey: ledgerKey(reservation.id, 'refund'),
        metadata: input.reason ? { reason: input.reason } : null,
      })
    }

    return reservation
  })
}

export async function extend(input: {
  reservationId: string
  ttlMs: number
}): Promise<BillingReservation> {
  const newExpiresAt = new Date(Date.now() + input.ttlMs)
  const updated = await db
    .update(billingReservations)
    .set({ expiresAt: newExpiresAt })
    .where(
      and(
        eq(billingReservations.id, input.reservationId),
        eq(billingReservations.status, 'reserved'),
      ),
    )
    .returning()

  if (updated.length === 0) {
    const current = await db
      .select()
      .from(billingReservations)
      .where(eq(billingReservations.id, input.reservationId))
      .limit(1)
    if (!current[0]) throw new ReservationNotFoundError(input.reservationId)
    throw new ReservationExpiredError(input.reservationId, current[0].status)
  }
  return updated[0]
}

export async function getReservation(reservationId: string): Promise<BillingReservation | null> {
  const rows = await db
    .select()
    .from(billingReservations)
    .where(eq(billingReservations.id, reservationId))
    .limit(1)
  return rows[0] ?? null
}

/**
 * Refund one expired reservation in a single short transaction. Returns
 * `true` if it actually transitioned a row; `false` if it was already moved.
 */
async function expireOne(reservationId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(billingReservations)
      .set({ status: 'expired' })
      .where(
        and(
          eq(billingReservations.id, reservationId),
          eq(billingReservations.status, 'reserved'),
        ),
      )
      .returning()

    if (updated.length === 0) return false

    const reservation = updated[0]
    if (reservation.estimatedCredits > 0n) {
      const credited = await tx
        .update(organizationWallets)
        .set({ balance: sql`${organizationWallets.balance} + ${reservation.estimatedCredits}` })
        .where(eq(organizationWallets.organizationId, reservation.organizationId))
        .returning({ balance: organizationWallets.balance })
      await tx.insert(billingLedger).values({
        reservationId: reservation.id,
        organizationId: reservation.organizationId,
        delta: reservation.estimatedCredits,
        kind: 'expire',
        balanceAfter: credited[0].balance,
        idempotencyKey: ledgerKey(reservation.id, 'expire'),
        metadata: null,
      })
    }
    return true
  })
}

export async function sweepExpired(limit = 100): Promise<number> {
  const candidates = await db
    .select({ id: billingReservations.id })
    .from(billingReservations)
    .where(
      and(
        eq(billingReservations.status, 'reserved'),
        lt(billingReservations.expiresAt, new Date()),
      ),
    )
    .limit(limit)

  let processed = 0
  for (const row of candidates) {
    try {
      const ok = await expireOne(row.id)
      if (ok) processed += 1
    } catch (err) {
      console.error('[billing.sweepExpired] failed to expire', row.id, err)
    }
  }
  return processed
}
