/**
 * Billing module tests — exercise the real Postgres database pointed to by
 * `DATABASE_URL`. Each test creates a fresh organization to avoid cross-test
 * pollution. Run with `bun test`.
 */

import { describe, expect, test, afterAll } from "bun:test"
import { randomUUID } from "node:crypto"
import { Elysia } from "elysia"
import { db } from "@/db"
import {
  organization,
  billingLedger,
  type BillingLedgerKind,
} from "@/db/schema"
import { eq, and } from "drizzle-orm"
import {
  BillingService,
  billingService,
  withBilling,
  withBillingAsync,
  InsufficientCreditsError,
  ReservationExpiredError,
  BillingTimeoutError,
  BillableConfigError,
} from "../index"
import type { Billable, BillableAsync } from "../types"

const billing = new BillingService()

const createdOrgs: string[] = []
async function newOrg(): Promise<string> {
  const id = `org_${randomUUID().slice(0, 8)}`
  await db.insert(organization).values({ id, name: `Test Org ${id}` })
  createdOrgs.push(id)
  return id
}

afterAll(async () => {
  if (createdOrgs.length > 0) {
    for (const id of createdOrgs) {
      await db.delete(organization).where(eq(organization.id, id))
    }
  }
})

async function seedBalance(orgId: string, amount: bigint): Promise<void> {
  await billing.topup({
    organizationId: orgId,
    amount,
    idempotencyKey: `seed:${orgId}:${randomUUID()}`,
  })
}

async function countLedger(
  orgId: string,
  kind?: BillingLedgerKind,
): Promise<number> {
  const rows = kind
    ? await db
        .select({ id: billingLedger.id })
        .from(billingLedger)
        .where(
          and(
            eq(billingLedger.organizationId, orgId),
            eq(billingLedger.kind, kind),
          ),
        )
    : await db
        .select({ id: billingLedger.id })
        .from(billingLedger)
        .where(eq(billingLedger.organizationId, orgId))
  return rows.length
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

// ----------------------------------------------------------------------------
// 1. balance & topup
// ----------------------------------------------------------------------------

describe("BillingService.getBalance / topup", () => {
  test("new org has zero balance", async () => {
    const org = await newOrg()
    expect(await billing.getBalance(org)).toBe(0n)
  })

  test("topup credits the wallet", async () => {
    const org = await newOrg()
    const after = await billing.topup({
      organizationId: org,
      amount: 1000n,
      idempotencyKey: `topup:${org}:1`,
    })
    expect(after).toBe(1000n)
    expect(await billing.getBalance(org)).toBe(1000n)
  })
})

// ----------------------------------------------------------------------------
// 2. reserve
// ----------------------------------------------------------------------------

describe("BillingService.reserve", () => {
  test("debits estimate atomically", async () => {
    const org = await newOrg()
    await seedBalance(org, 500n)
    const res = await billing.reserve({
      organizationId: org,
      operation: "test.op",
      estimatedCredits: 100n,
      ttlMs: 60_000,
      idempotencyKey: `r:${randomUUID()}`,
    })
    expect(res.status).toBe("reserved")
    expect(res.estimatedCredits).toBe(100n)
    expect(await billing.getBalance(org)).toBe(400n)
  })

  test("throws InsufficientCreditsError when balance < estimate, wallet untouched", async () => {
    const org = await newOrg()
    await seedBalance(org, 50n)
    await expect(
      billing.reserve({
        organizationId: org,
        operation: "test.op",
        estimatedCredits: 100n,
        ttlMs: 60_000,
        idempotencyKey: `r:${randomUUID()}`,
      }),
    ).rejects.toBeInstanceOf(InsufficientCreditsError)
    expect(await billing.getBalance(org)).toBe(50n)
  })

  test("idempotent — same key debits only once", async () => {
    const org = await newOrg()
    await seedBalance(org, 1000n)
    const key = `r:${randomUUID()}`
    const r1 = await billing.reserve({
      organizationId: org,
      operation: "test.op",
      estimatedCredits: 200n,
      ttlMs: 60_000,
      idempotencyKey: key,
    })
    const r2 = await billing.reserve({
      organizationId: org,
      operation: "test.op",
      estimatedCredits: 200n,
      ttlMs: 60_000,
      idempotencyKey: key,
    })
    expect(r1.id).toBe(r2.id)
    expect(await billing.getBalance(org)).toBe(800n)
  })

  test("50 parallel reserves on a balance of 10x estimate succeed exactly 10 times", async () => {
    const org = await newOrg()
    const estimate = 100n
    await seedBalance(org, estimate * 10n)

    const results = await Promise.allSettled(
      Array.from({ length: 50 }).map((_, i) =>
        billing.reserve({
          organizationId: org,
          operation: "concurrent.test",
          estimatedCredits: estimate,
          ttlMs: 60_000,
          idempotencyKey: `concurrent:${org}:${i}`,
        }),
      ),
    )

    const succeeded = results.filter((r) => r.status === "fulfilled").length
    const failed = results.filter((r) => r.status === "rejected").length
    expect(succeeded).toBe(10)
    expect(failed).toBe(40)
    expect(await billing.getBalance(org)).toBe(0n)

    const debits = await countLedger(org, "reserve")
    // 1 topup + 10 reserves recorded; the reserve-kind count is 10.
    expect(debits).toBe(10)
  })
})

// ----------------------------------------------------------------------------
// 3. settle (under, over with cover, over uncovered)
// ----------------------------------------------------------------------------

describe("BillingService.settle", () => {
  test("actual < estimated refunds the difference", async () => {
    const org = await newOrg()
    await seedBalance(org, 500n)
    const res = await billing.reserve({
      organizationId: org,
      operation: "test.under",
      estimatedCredits: 200n,
      ttlMs: 60_000,
      idempotencyKey: `r:${randomUUID()}`,
    })
    expect(await billing.getBalance(org)).toBe(300n)

    const settled = await billing.settle({
      reservationId: res.id,
      actualCredits: 70n,
    })
    expect(settled.status).toBe("settled")
    expect(await billing.getBalance(org)).toBe(430n)
  })

  test("actual > estimated debits the difference when balance covers it", async () => {
    const org = await newOrg()
    await seedBalance(org, 500n)
    const res = await billing.reserve({
      organizationId: org,
      operation: "test.over",
      estimatedCredits: 100n,
      ttlMs: 60_000,
      idempotencyKey: `r:${randomUUID()}`,
    })
    // balance = 400
    await billing.settle({ reservationId: res.id, actualCredits: 250n })
    // total debit = 250, balance = 250
    expect(await billing.getBalance(org)).toBe(250n)
  })

  test("actual > estimated with no remaining balance: drains to 0 and records overage_uncovered", async () => {
    const org = await newOrg()
    await seedBalance(org, 100n)
    const res = await billing.reserve({
      organizationId: org,
      operation: "test.overage",
      estimatedCredits: 100n,
      ttlMs: 60_000,
      idempotencyKey: `r:${randomUUID()}`,
    })
    // balance is exactly 0 after reserve
    expect(await billing.getBalance(org)).toBe(0n)

    await billing.settle({ reservationId: res.id, actualCredits: 250n })
    expect(await billing.getBalance(org)).toBe(0n) // never goes negative
    expect(await countLedger(org, "overage_uncovered")).toBe(1)
  })

  test("double settle is a no-op (status guard)", async () => {
    const org = await newOrg()
    await seedBalance(org, 500n)
    const res = await billing.reserve({
      organizationId: org,
      operation: "test.dbl",
      estimatedCredits: 100n,
      ttlMs: 60_000,
      idempotencyKey: `r:${randomUUID()}`,
    })
    await billing.settle({ reservationId: res.id, actualCredits: 50n })
    const balanceAfter = await billing.getBalance(org)
    await expect(
      billing.settle({ reservationId: res.id, actualCredits: 50n }),
    ).rejects.toBeInstanceOf(ReservationExpiredError)
    expect(await billing.getBalance(org)).toBe(balanceAfter)
  })
})

// ----------------------------------------------------------------------------
// 4. refund
// ----------------------------------------------------------------------------

describe("BillingService.refund", () => {
  test("returns full estimate", async () => {
    const org = await newOrg()
    await seedBalance(org, 500n)
    const res = await billing.reserve({
      organizationId: org,
      operation: "test.refund",
      estimatedCredits: 200n,
      ttlMs: 60_000,
      idempotencyKey: `r:${randomUUID()}`,
    })
    expect(await billing.getBalance(org)).toBe(300n)
    await billing.refund(res.id)
    expect(await billing.getBalance(org)).toBe(500n)
  })

  test("second refund is a no-op", async () => {
    const org = await newOrg()
    await seedBalance(org, 500n)
    const res = await billing.reserve({
      organizationId: org,
      operation: "test.refund",
      estimatedCredits: 200n,
      ttlMs: 60_000,
      idempotencyKey: `r:${randomUUID()}`,
    })
    await billing.refund(res.id)
    await billing.refund(res.id) // no-op, no throw
    expect(await billing.getBalance(org)).toBe(500n)
    expect(await countLedger(org, "refund")).toBe(1)
  })
})

// ----------------------------------------------------------------------------
// 5. withBilling (sync wrapper)
// ----------------------------------------------------------------------------

function makeBillable<TIn, TOut>(
  overrides: Partial<Billable<TIn, TOut>> & {
    execute: Billable<TIn, TOut>["execute"]
    estimateCost: Billable<TIn, TOut>["estimateCost"]
  },
): Billable<TIn, TOut> {
  return {
    operation: "test.billable",
    timeoutMs: 5_000,
    ttlMs: 60_000,
    idempotencyKey: () => `key:${randomUUID()}`,
    ...overrides,
  }
}

describe("withBilling", () => {
  test("happy path: estimate → execute → settle", async () => {
    const org = await newOrg()
    await seedBalance(org, 500n)
    const billable = makeBillable<{ value: number }, string>({
      operation: "test.happy",
      estimateCost: () => 100n,
      execute: async (input) => ({
        output: `hello-${input.value}`,
        actualCredits: 80n,
      }),
    })
    const callable = withBilling(billable, billing)
    const result = await callable({ value: 42 }, { organizationId: org })
    expect(result).toBe("hello-42")
    // 500 - 100 (reserve) + 20 (refund diff on settle) = 420
    expect(await billing.getBalance(org)).toBe(420n)
  })

  test("refunds and rethrows on execute error", async () => {
    const org = await newOrg()
    await seedBalance(org, 500n)
    const boom = new Error("boom")
    const billable = makeBillable<void, void>({
      operation: "test.error",
      estimateCost: () => 100n,
      execute: async () => {
        throw boom
      },
    })
    const callable = withBilling(billable, billing)
    await expect(
      callable(undefined as void, { organizationId: org }),
    ).rejects.toBe(boom)
    expect(await billing.getBalance(org)).toBe(500n)
  })

  test("refunds and throws BillingTimeoutError on timeout", async () => {
    const org = await newOrg()
    await seedBalance(org, 500n)
    const billable = makeBillable<void, void>({
      operation: "test.timeout",
      timeoutMs: 50,
      ttlMs: 60_000,
      estimateCost: () => 100n,
      execute: async (_input, ctx) => {
        await new Promise<void>((_, reject) => {
          const t = setTimeout(() => reject(new Error("should-not-fire")), 500)
          ctx.signal.addEventListener("abort", () => {
            clearTimeout(t)
            reject(new Error("aborted"))
          })
        })
        return { output: undefined, actualCredits: 0n }
      },
    })
    const callable = withBilling(billable, billing)
    await expect(
      callable(undefined as void, { organizationId: org }),
    ).rejects.toBeInstanceOf(BillingTimeoutError)
    expect(await billing.getBalance(org)).toBe(500n)
  })
})

// ----------------------------------------------------------------------------
// 6. withBillingAsync + G1 (TTL extension, guardrail)
// ----------------------------------------------------------------------------

describe("withBillingAsync", () => {
  test("reserve → submit → settle later transitions reserved → settled", async () => {
    const org = await newOrg()
    await seedBalance(org, 500n)
    const billable: BillableAsync<void, { jobId: string }> = {
      operation: "test.async",
      timeoutMs: 5_000,
      ttlMs: 60_000,
      estimateCost: () => 100n,
      idempotencyKey: () => `async:${randomUUID()}`,
      submit: async () => ({ jobId: "job-1" }),
    }
    const start = withBillingAsync(billable, billing)
    const handle = await start(undefined as void, { organizationId: org })
    expect(handle.jobHandle.jobId).toBe("job-1")
    expect(await billing.getBalance(org)).toBe(400n)

    await billing.settle({
      reservationId: handle.reservationId,
      actualCredits: 75n,
    })
    expect(await billing.getBalance(org)).toBe(425n)
  })

  test("async expiry: sweepExpired refunds; subsequent settle throws ReservationExpiredError", async () => {
    const org = await newOrg()
    await seedBalance(org, 500n)
    const res = await billing.reserve({
      organizationId: org,
      operation: "test.async.expire",
      estimatedCredits: 100n,
      ttlMs: 50,
      idempotencyKey: `r:${randomUUID()}`,
    })
    expect(await billing.getBalance(org)).toBe(400n)
    await sleep(120)
    const swept = await billing.sweepExpired()
    expect(swept).toBeGreaterThanOrEqual(1)
    expect(await billing.getBalance(org)).toBe(500n)

    await expect(
      billing.settle({ reservationId: res.id, actualCredits: 50n }),
    ).rejects.toBeInstanceOf(ReservationExpiredError)
  })

  test("G1: renewIfNearExpiry keeps a long-running async job alive past the original TTL", async () => {
    const org = await newOrg()
    await seedBalance(org, 500n)
    // The wrapper requires ttlMs >= timeoutMs * 2.
    const billable: BillableAsync<void, { id: string }> = {
      operation: "test.async.renew",
      timeoutMs: 100,
      ttlMs: 300,
      estimateCost: () => 100n,
      idempotencyKey: () => `renew:${randomUUID()}`,
      submit: async () => ({ id: "job" }),
    }
    const start = withBillingAsync(billable, billing)
    const handle = await start(undefined as void, { organizationId: org })

    // Drive a "poll loop" past the original TTL while renewing.
    for (let i = 0; i < 8; i++) {
      await sleep(80)
      await handle.renewIfNearExpiry()
      await billing.sweepExpired().catch(() => {})
    }

    const settled = await billing.settle({
      reservationId: handle.reservationId,
      actualCredits: 90n,
    })
    expect(settled.status).toBe("settled")
    expect(await billing.getBalance(org)).toBe(410n)
    expect(await countLedger(org, "expire")).toBe(0)
    expect(await countLedger(org, "refund")).toBe(0)
  })

  test("G1 guardrail: ttlMs < timeoutMs * 2 throws BillableConfigError at first call", async () => {
    const org = await newOrg()
    await seedBalance(org, 500n)
    const badBillable: BillableAsync<void, void> = {
      operation: "test.bad-ttl",
      timeoutMs: 1000,
      ttlMs: 500, // less than 2x timeoutMs
      estimateCost: () => 10n,
      idempotencyKey: () => `bad:${randomUUID()}`,
      submit: async () => {},
    }
    expect(() => withBillingAsync(badBillable, billing)).toThrow(
      BillableConfigError,
    )
  })
})

// ----------------------------------------------------------------------------
// 7. balance endpoint
// ----------------------------------------------------------------------------

describe("GET /billing/balance", () => {
  test("returns 401 when unauthenticated", async () => {
    // Re-import to avoid the module-scoped singleton starting a sweeper.
    const { billingRoutes } = await import("../index")
    const app = new Elysia().use(billingRoutes)
    const res = await app.handle(
      new Request("http://localhost/billing/balance"),
    )
    expect(res.status).toBe(401)
    // Stop sweeper started by the module singleton if any.
    billingService.stopSweeper()
  })
})
