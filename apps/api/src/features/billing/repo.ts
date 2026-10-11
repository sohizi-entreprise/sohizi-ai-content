/** Wallet mutations are serialized by the organization wallet row lock. */
import { db } from "@/db"
import {
  organizationWallets,
  billingReservations,
  billingLedger,
} from "@/db/schema"
import type {
  BillingReservation,
  BillingLedgerKind,
  OrganizationWallet,
} from "@/db/schema"
import { eq, and, lt, lte, or, asc } from "drizzle-orm"
import {
  InsufficientCreditsError,
  ReservationExpiredError,
  ReservationNotFoundError,
} from "./errors"
import type { Credits } from "./types"

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
type Wallet = OrganizationWallet

const ledgerKey = (reservationId: string, kind: BillingLedgerKind) =>
  `${reservationId}:${kind}`
const total = (wallet: Wallet) => wallet.balance + wallet.paygBalance

async function ensureWallet(orgId: string, tx: Tx): Promise<void> {
  await tx
    .insert(organizationWallets)
    .values({ organizationId: orgId, balance: 0n, paygBalance: 0n })
    .onConflictDoNothing()
}

async function lockWallet(orgId: string, tx: Tx): Promise<Wallet> {
  await ensureWallet(orgId, tx)
  const [wallet] = await tx
    .select()
    .from(organizationWallets)
    .where(eq(organizationWallets.organizationId, orgId))
    .for("update")
  return wallet
}

async function saveWallet(wallet: Wallet, tx: Tx): Promise<void> {
  await tx
    .update(organizationWallets)
    .set({
      balance: wallet.balance,
      balanceExpiresAt: wallet.balanceExpiresAt,
      balanceGeneration: wallet.balanceGeneration,
      paygBalance: wallet.paygBalance,
      paygBalanceExpiresAt: wallet.paygBalanceExpiresAt,
      paygGeneration: wallet.paygGeneration,
    })
    .where(eq(organizationWallets.organizationId, wallet.organizationId))
}

async function writeLedger(
  tx: Tx,
  input: {
    organizationId: string
    reservationId?: string | null
    kind: BillingLedgerKind
    balanceDelta: bigint
    paygDelta: bigint
    balanceAfter: bigint
    idempotencyKey: string
    metadata?: Record<string, unknown> | null
  },
): Promise<void> {
  await tx.insert(billingLedger).values({
    organizationId: input.organizationId,
    reservationId: input.reservationId ?? null,
    kind: input.kind,
    delta: input.balanceDelta + input.paygDelta,
    balanceDelta: input.balanceDelta,
    paygDelta: input.paygDelta,
    balanceAfter: input.balanceAfter,
    idempotencyKey: input.idempotencyKey,
    metadata: input.metadata ?? null,
  })
}

/** Clear expired pools while holding the wallet lock. Expiry is inclusive. */
async function expireWallet(wallet: Wallet, tx: Tx, now: Date): Promise<void> {
  if (wallet.balanceExpiresAt && wallet.balanceExpiresAt <= now) {
    const expired = wallet.balance
    const generation = wallet.balanceGeneration
    wallet.balance = 0n
    wallet.balanceExpiresAt = null
    wallet.balanceGeneration += 1n
    await saveWallet(wallet, tx)
    if (expired > 0n)
      await writeLedger(tx, {
        organizationId: wallet.organizationId,
        kind: "expire",
        balanceDelta: -expired,
        paygDelta: 0n,
        balanceAfter: total(wallet),
        idempotencyKey: `wallet:${wallet.organizationId}:balance:${generation}:expire`,
      })
  }
  if (wallet.paygBalanceExpiresAt && wallet.paygBalanceExpiresAt <= now) {
    const expired = wallet.paygBalance
    const generation = wallet.paygGeneration
    wallet.paygBalance = 0n
    wallet.paygBalanceExpiresAt = null
    wallet.paygGeneration += 1n
    await saveWallet(wallet, tx)
    if (expired > 0n)
      await writeLedger(tx, {
        organizationId: wallet.organizationId,
        kind: "expire",
        balanceDelta: 0n,
        paygDelta: -expired,
        balanceAfter: total(wallet),
        idempotencyKey: `wallet:${wallet.organizationId}:payg:${generation}:expire`,
      })
  }
}

export async function getBalances(orgId: string): Promise<{
  balance: bigint
  subscriptionBalance: bigint
  paygBalance: bigint
  balanceExpiresAt: Date | null
  paygBalanceExpiresAt: Date | null
}> {
  return db.transaction(async (tx) => {
    const wallet = await lockWallet(orgId, tx)
    await expireWallet(wallet, tx, new Date())
    return {
      balance: total(wallet),
      subscriptionBalance: wallet.balance,
      paygBalance: wallet.paygBalance,
      balanceExpiresAt: wallet.balanceExpiresAt,
      paygBalanceExpiresAt: wallet.paygBalanceExpiresAt,
    }
  })
}

export async function getBalance(orgId: string): Promise<bigint> {
  return (await getBalances(orgId)).balance
}

/** Claim the ledger key before changing the wallet. Retrying an identical grant is a no-op. */
async function claimGrant(
  tx: Tx,
  wallet: Wallet,
  input: {
    amount: bigint
    idempotencyKey: string
    source: "balance" | "payg"
    metadata?: Record<string, unknown>
  },
): Promise<boolean> {
  const balanceDelta = input.source === "balance" ? input.amount : 0n
  const paygDelta = input.source === "payg" ? input.amount : 0n
  const inserted = await tx
    .insert(billingLedger)
    .values({
      organizationId: wallet.organizationId,
      reservationId: null,
      delta: input.amount,
      balanceDelta,
      paygDelta,
      kind: "topup",
      balanceAfter: total(wallet), // updated in this transaction after the wallet change
      idempotencyKey: input.idempotencyKey,
      metadata: { ...input.metadata, source: input.source },
    })
    .onConflictDoNothing({ target: billingLedger.idempotencyKey })
    .returning({ id: billingLedger.id })
  if (inserted.length > 0) return true
  const [existing] = await tx
    .select()
    .from(billingLedger)
    .where(eq(billingLedger.idempotencyKey, input.idempotencyKey))
    .limit(1)
  if (
    !existing ||
    existing.organizationId !== wallet.organizationId ||
    existing.kind !== "topup" ||
    existing.delta !== input.amount ||
    existing.balanceDelta !== balanceDelta ||
    existing.paygDelta !== paygDelta
  ) {
    throw new Error("Billing idempotency key reused for a different grant")
  }
  return false
}

async function finishGrant(tx: Tx, wallet: Wallet, key: string): Promise<void> {
  await saveWallet(wallet, tx)
  await tx
    .update(billingLedger)
    .set({ balanceAfter: total(wallet) })
    .where(eq(billingLedger.idempotencyKey, key))
}

export async function topup(input: {
  organizationId: string
  amount: Credits
  idempotencyKey: string
  metadata?: Record<string, unknown>
}): Promise<bigint> {
  if (input.amount <= 0n) throw new Error("topup amount must be positive")
  return db.transaction(async (tx) => {
    const wallet = await lockWallet(input.organizationId, tx)
    await expireWallet(wallet, tx, new Date())
    if (await claimGrant(tx, wallet, { ...input, source: "balance" })) {
      wallet.balance += input.amount
      await finishGrant(tx, wallet, input.idempotencyKey)
    }
    return total(wallet)
  })
}

export async function grantPaygCredits(input: {
  organizationId: string
  amount: Credits
  idempotencyKey: string
  metadata?: Record<string, unknown>
}): Promise<bigint> {
  if (input.amount <= 0n) throw new Error("PAYG grant amount must be positive")
  return db.transaction(async (tx) => {
    const wallet = await lockWallet(input.organizationId, tx)
    const now = new Date()
    await expireWallet(wallet, tx, now)
    if (await claimGrant(tx, wallet, { ...input, source: "payg" })) {
      wallet.paygBalance += input.amount
      const renewed = new Date(now)
      renewed.setUTCFullYear(renewed.getUTCFullYear() + 1)
      wallet.paygBalanceExpiresAt = renewed
      await finishGrant(tx, wallet, input.idempotencyKey)
    }
    return total(wallet)
  })
}

export interface ReserveRow extends BillingReservation {
  created: boolean
}

export async function reserve(input: {
  organizationId: string
  userId?: string | null
  operation: string
  estimatedCredits: Credits
  ttlMs: number
  idempotencyKey: string
  id?: string
  metadata?: Record<string, unknown>
}): Promise<ReserveRow> {
  if (input.estimatedCredits < 0n)
    throw new Error("estimatedCredits must be >= 0")
  return db.transaction(async (tx) => {
    const wallet = await lockWallet(input.organizationId, tx)
    await expireWallet(wallet, tx, new Date())
    const balanceReserved =
      input.estimatedCredits < wallet.balance
        ? input.estimatedCredits
        : wallet.balance
    const paygReserved = input.estimatedCredits - balanceReserved
    // Claim the key first; a duplicate must not require the current balance.
    const inserted = await tx
      .insert(billingReservations)
      .values({
        ...(input.id ? { id: input.id } : {}),
        idempotencyKey: input.idempotencyKey,
        organizationId: input.organizationId,
        userId: input.userId ?? null,
        operation: input.operation,
        estimatedCredits: input.estimatedCredits,
        balanceReserved,
        paygReserved,
        balanceGeneration: wallet.balanceGeneration,
        paygGeneration: wallet.paygGeneration,
        status: "reserved",
        expiresAt: new Date(Date.now() + input.ttlMs),
        metadata: input.metadata ?? null,
      })
      .onConflictDoNothing({ target: billingReservations.idempotencyKey })
      .returning()
    if (inserted.length === 0) {
      const [existing] = await tx
        .select()
        .from(billingReservations)
        .where(eq(billingReservations.idempotencyKey, input.idempotencyKey))
        .limit(1)
      if (!existing)
        throw new Error("Reservation idempotency conflict without a row")
      if (
        existing.organizationId !== input.organizationId ||
        existing.estimatedCredits !== input.estimatedCredits ||
        existing.operation !== input.operation
      ) {
        throw new Error(
          "Billing idempotency key reused for a different reservation",
        )
      }
      return { ...existing, created: false }
    }
    if (paygReserved > wallet.paygBalance) {
      throw new InsufficientCreditsError(
        input.organizationId,
        input.estimatedCredits,
        total(wallet),
      )
    }
    wallet.balance -= balanceReserved
    wallet.paygBalance -= paygReserved
    await saveWallet(wallet, tx)
    await writeLedger(tx, {
      reservationId: inserted[0].id,
      organizationId: input.organizationId,
      kind: "reserve",
      balanceDelta: -balanceReserved,
      paygDelta: -paygReserved,
      balanceAfter: total(wallet),
      idempotencyKey: ledgerKey(inserted[0].id, "reserve"),
      metadata: input.metadata,
    })
    return { ...inserted[0], created: true }
  })
}

async function lockReservationWallet(
  tx: Tx,
  reservationId: string,
): Promise<{ reservation: BillingReservation; wallet: Wallet }> {
  const [reservation] = await tx
    .select()
    .from(billingReservations)
    .where(eq(billingReservations.id, reservationId))
    .limit(1)
  if (!reservation) throw new ReservationNotFoundError(reservationId)
  const wallet = await lockWallet(reservation.organizationId, tx)
  await expireWallet(wallet, tx, new Date())
  return { reservation, wallet }
}

/** Refund the PAYG portion first, then subscription, preserving subscription-first spend. */
function returnReserved(
  wallet: Wallet,
  reservation: BillingReservation,
  amount: bigint,
): { balanceDelta: bigint; paygDelta: bigint } {
  const paygDelta =
    reservation.paygGeneration === wallet.paygGeneration &&
    wallet.paygBalanceExpiresAt
      ? amount < reservation.paygReserved
        ? amount
        : reservation.paygReserved
      : 0n
  const remaining =
    amount -
    (amount < reservation.paygReserved ? amount : reservation.paygReserved)
  const balanceDelta =
    reservation.balanceGeneration === wallet.balanceGeneration &&
    (!wallet.balanceExpiresAt || wallet.balanceExpiresAt > new Date())
      ? remaining < reservation.balanceReserved
        ? remaining
        : reservation.balanceReserved
      : 0n
  wallet.paygBalance += paygDelta
  wallet.balance += balanceDelta
  return { balanceDelta, paygDelta }
}

function debitAvailable(
  wallet: Wallet,
  amount: bigint,
): { balanceDelta: bigint; paygDelta: bigint; uncovered: bigint } {
  const fromBalance = amount < wallet.balance ? amount : wallet.balance
  wallet.balance -= fromBalance
  const rest = amount - fromBalance
  const fromPayg = rest < wallet.paygBalance ? rest : wallet.paygBalance
  wallet.paygBalance -= fromPayg
  return {
    balanceDelta: -fromBalance,
    paygDelta: -fromPayg,
    uncovered: rest - fromPayg,
  }
}

export async function settle(input: {
  reservationId: string
  actualCredits: Credits
  metadata?: Record<string, unknown>
}): Promise<BillingReservation> {
  if (input.actualCredits < 0n) throw new Error("actualCredits must be >= 0")
  return db.transaction(async (tx) => {
    const { wallet } = await lockReservationWallet(tx, input.reservationId)
    const [reservation] = await tx
      .update(billingReservations)
      .set({ status: "settled", actualCredits: input.actualCredits })
      .where(
        and(
          eq(billingReservations.id, input.reservationId),
          eq(billingReservations.status, "reserved"),
        ),
      )
      .returning()
    if (!reservation) {
      const [current] = await tx
        .select()
        .from(billingReservations)
        .where(eq(billingReservations.id, input.reservationId))
        .limit(1)
      throw new ReservationExpiredError(input.reservationId, current.status)
    }
    const diff = reservation.estimatedCredits - input.actualCredits
    if (diff > 0n) {
      const { balanceDelta, paygDelta } = returnReserved(
        wallet,
        reservation,
        diff,
      )
      await saveWallet(wallet, tx)
      if (balanceDelta + paygDelta > 0n)
        await writeLedger(tx, {
          reservationId: reservation.id,
          organizationId: wallet.organizationId,
          kind: "settle_diff",
          balanceDelta,
          paygDelta,
          balanceAfter: total(wallet),
          idempotencyKey: ledgerKey(reservation.id, "settle_diff"),
          metadata: input.metadata,
        })
    } else if (diff < 0n) {
      const { balanceDelta, paygDelta, uncovered } = debitAvailable(
        wallet,
        -diff,
      )
      await saveWallet(wallet, tx)
      if (balanceDelta + paygDelta < 0n)
        await writeLedger(tx, {
          reservationId: reservation.id,
          organizationId: wallet.organizationId,
          kind: "settle_diff",
          balanceDelta,
          paygDelta,
          balanceAfter: total(wallet),
          idempotencyKey: ledgerKey(reservation.id, "settle_diff"),
          metadata: input.metadata,
        })
      if (uncovered > 0n)
        await writeLedger(tx, {
          reservationId: reservation.id,
          organizationId: wallet.organizationId,
          kind: "overage_uncovered",
          balanceDelta: 0n,
          paygDelta: 0n,
          balanceAfter: total(wallet),
          idempotencyKey: ledgerKey(reservation.id, "overage_uncovered"),
          metadata: { ...input.metadata, uncovered: uncovered.toString() },
        })
    }
    return reservation
  })
}

async function refundReserved(
  tx: Tx,
  reservationId: string,
  status: "refunded" | "expired",
  reason?: string,
): Promise<BillingReservation | null> {
  const { wallet } = await lockReservationWallet(tx, reservationId)
  const [reservation] = await tx
    .update(billingReservations)
    .set({ status })
    .where(
      and(
        eq(billingReservations.id, reservationId),
        eq(billingReservations.status, "reserved"),
      ),
    )
    .returning()
  if (!reservation) return null
  const { balanceDelta, paygDelta } = returnReserved(
    wallet,
    reservation,
    reservation.estimatedCredits,
  )
  await saveWallet(wallet, tx)
  if (balanceDelta + paygDelta > 0n)
    await writeLedger(tx, {
      reservationId,
      organizationId: wallet.organizationId,
      kind: status === "expired" ? "expire" : "refund",
      balanceDelta,
      paygDelta,
      balanceAfter: total(wallet),
      idempotencyKey: ledgerKey(
        reservationId,
        status === "expired" ? "expire" : "refund",
      ),
      metadata: reason ? { reason } : null,
    })
  return reservation
}

export async function refund(input: {
  reservationId: string
  reason?: string
}): Promise<BillingReservation | null> {
  return db.transaction((tx) =>
    refundReserved(tx, input.reservationId, "refunded", input.reason),
  )
}

export async function extend(input: {
  reservationId: string
  ttlMs: number
}): Promise<BillingReservation> {
  const updated = await db
    .update(billingReservations)
    .set({ expiresAt: new Date(Date.now() + input.ttlMs) })
    .where(
      and(
        eq(billingReservations.id, input.reservationId),
        eq(billingReservations.status, "reserved"),
      ),
    )
    .returning()
  if (updated.length > 0) return updated[0]
  const current = await getReservation(input.reservationId)
  if (!current) throw new ReservationNotFoundError(input.reservationId)
  throw new ReservationExpiredError(input.reservationId, current.status)
}

export async function getReservation(
  reservationId: string,
): Promise<BillingReservation | null> {
  const [row] = await db
    .select()
    .from(billingReservations)
    .where(eq(billingReservations.id, reservationId))
    .limit(1)
  return row ?? null
}

export async function sweepExpired(limit = 100): Promise<number> {
  const candidates = await db
    .select({ id: billingReservations.id })
    .from(billingReservations)
    .where(
      and(
        eq(billingReservations.status, "reserved"),
        lt(billingReservations.expiresAt, new Date()),
      ),
    )
    .orderBy(asc(billingReservations.expiresAt))
    .limit(limit)
  let processed = 0
  const failures: unknown[] = []
  for (const row of candidates) {
    try {
      const result = await db.transaction((tx) =>
        refundReserved(tx, row.id, "expired"),
      )
      if (result) processed++
    } catch (err) {
      console.error("[billing.sweepExpired] failed to expire", row.id, err)
      failures.push(err)
    }
  }
  if (failures.length > 0) {
    throw new AggregateError(
      failures,
      `Failed to expire ${failures.length} billing reservation(s)`,
    )
  }
  return processed
}

/** Proactively expire idle wallets; normal reads and writes also expire lazily. */
export async function sweepExpiredWallets(limit = 100): Promise<number> {
  const now = new Date()
  const candidates = await db
    .select({ organizationId: organizationWallets.organizationId })
    .from(organizationWallets)
    .where(
      or(
        lte(organizationWallets.balanceExpiresAt, now),
        lte(organizationWallets.paygBalanceExpiresAt, now),
      ),
    )
    .orderBy(asc(organizationWallets.organizationId))
    .limit(limit)
  let processed = 0
  const failures: unknown[] = []
  for (const { organizationId } of candidates) {
    try {
      await db.transaction(async (tx) => {
        const wallet = await lockWallet(organizationId, tx)
        await expireWallet(wallet, tx, new Date())
      })
      processed++
    } catch (err) {
      console.error(
        "[billing.sweepExpiredWallets] failed to expire",
        organizationId,
        err,
      )
      failures.push(err)
    }
  }
  if (failures.length > 0) {
    throw new AggregateError(
      failures,
      `Failed to expire ${failures.length} organization wallet(s)`,
    )
  }
  return processed
}
