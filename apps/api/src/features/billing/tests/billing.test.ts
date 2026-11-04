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
  user,
  member,
  organizationWallets,
  polarProcessedOrders,
  billingLedger,
  billingReservations,
  type BillingLedgerKind,
} from "@/db/schema"
import { eq, and } from "drizzle-orm"
import {
  BillingService,
  withBilling,
  withBillingAsync,
  withBillingStream,
  InsufficientCreditsError,
  ReservationExpiredError,
  BillingTimeoutError,
  BillableConfigError,
} from "../index"
import type { Billable, BillableAsync, BillableStream } from "../types"
import { billingContext } from "../index"
import {
  catalogEntry,
  grantOrder,
  handleOrderRefunded,
  hasPaidAccess,
  planChangeBehavior,
  planTier,
  syncSubscription,
} from "../polar"
import type { models } from "@polar-sh/sdk/2026-10"

const billing = new BillingService()

const createdOrgs: string[] = []
async function newOrg(): Promise<string> {
  const id = `org_${randomUUID().slice(0, 8)}`
  await db.insert(organization).values({
    id,
    name: `Test Org ${id}`,
    slug: id,
  })
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

async function seedPayg(orgId: string, amount: bigint, key = randomUUID()) {
  return billing.grantPaygCredits({
    organizationId: orgId,
    amount,
    idempotencyKey: `payg:${key}`,
  })
}

async function expirePayg(orgId: string) {
  await db
    .update(organizationWallets)
    .set({ paygBalanceExpiresAt: new Date(0) })
    .where(eq(organizationWallets.organizationId, orgId))
}

async function wallet(orgId: string) {
  const [row] = await db
    .select()
    .from(organizationWallets)
    .where(eq(organizationWallets.organizationId, orgId))
  return row
}

async function ledgerTotal(orgId: string) {
  const rows = await db
    .select()
    .from(billingLedger)
    .where(eq(billingLedger.organizationId, orgId))
  return rows.reduce((sum, row) => sum + row.delta, 0n)
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

describe("organization billing access", () => {
  test("members can view but only owners and admins can manage", async () => {
    const org = await newOrg()
    const ids = [randomUUID(), randomUUID(), randomUUID()]
    try {
      for (const [index, role] of ["owner", "admin", "member"].entries()) {
        await db.insert(user).values({
          id: ids[index],
          name: role,
          email: `${ids[index]}@example.com`,
        })
        await db.insert(member).values({
          id: randomUUID(),
          userId: ids[index],
          organizationId: org,
          role,
        })
      }
      expect(
        (await billingContext(ids[2], { activeOrganizationId: org })).canManage,
      ).toBe(false)
      expect(
        (await billingContext(ids[0], { activeOrganizationId: org }, true))
          .canManage,
      ).toBe(true)
      expect(
        (await billingContext(ids[1], { activeOrganizationId: org }, true))
          .canManage,
      ).toBe(true)
      await expect(
        billingContext(ids[2], { activeOrganizationId: org }, true),
      ).rejects.toThrow("billing manager")
      await expect(
        billingContext(ids[0], { activeOrganizationId: "another-org" }, true),
      ).rejects.toThrow("Not a member")
    } finally {
      for (const id of ids) await db.delete(user).where(eq(user.id, id))
    }
  })

  test("Free and expired organizations cannot buy packs", async () => {
    const org = await newOrg()
    expect(hasPaidAccess(await getBillingForTest(org))).toBe(false)
    await db.insert(organizationWallets).values({
      organizationId: org,
      productId: "plan",
      allowance: 100n,
      status: "active",
      periodEnd: new Date(Date.now() - 1000),
    })
    expect(hasPaidAccess(await getBillingForTest(org))).toBe(false)
    await db
      .update(organizationWallets)
      .set({
        periodEnd: new Date(Date.now() + 86_400_000),
        cancelAtPeriodEnd: true,
      })
      .where(eq(organizationWallets.organizationId, org))
    expect(hasPaidAccess(await getBillingForTest(org))).toBe(true)
  })
})

describe("Polar order grants", () => {
  test("plan tiers must be positive integers and determine change timing", () => {
    expect(planTier({ planTier: 1 })).toBe(1)
    expect(planTier({ planTier: "2" })).toBe(2)
    for (const value of [undefined, 0, -1, 1.5, "0", "1.5", "abc"])
      expect(planTier({ planTier: value })).toBeNull()
    expect(planChangeBehavior(1, 2)).toBe("reset")
    expect(planChangeBehavior(2, 1)).toBe("next_period")
    expect(planChangeBehavior(1, 1)).toBeNull()
  })

  test("catalog entry distinguishes fixed plans from unit-based packs", () => {
    const plan = catalogEntry({
      id: "plan",
      name: "Creator",
      description: null,
      is_archived: false,
      visibility: "public",
      is_recurring: true,
      recurring_interval: "month",
      recurring_interval_count: 1,
      trial_interval: null,
      metadata: { creditAmount: 2500, planTier: 1 },
      prices: [
        {
          amount_type: "fixed",
          is_archived: false,
          price_amount: 3200,
          price_currency: "usd",
        },
      ],
    } as unknown as models.Product)
    expect(plan).toMatchObject({
      kind: "plan",
      credits: 2500,
      planTier: 1,
      priceAmount: 3200,
      currency: "usd",
      unitAmount: null,
    })

    const pack = catalogEntry({
      id: "pack",
      name: "Pay as you go",
      description: null,
      is_archived: false,
      visibility: "public",
      is_recurring: false,
      metadata: {},
      prices: [
        {
          amount_type: "unit_based",
          is_archived: false,
          price_currency: "usd",
          minimum_units: 250,
          maximum_units: null,
          tiers: { type: "volume", tiers: [{ unit_amount: "2" }] },
        },
      ],
    } as unknown as models.Product)
    expect(pack).toMatchObject({
      kind: "pack",
      credits: null,
      planTier: null,
      priceAmount: null,
      unitAmount: 2,
      minimumUnits: 250,
      maximumUnits: null,
      currency: "usd",
    })

    expect(
      catalogEntry({
        id: "draft",
        name: "Hidden",
        is_archived: false,
        visibility: "draft",
        is_recurring: false,
        metadata: {},
        prices: [
          {
            amount_type: "unit_based",
            is_archived: false,
            price_currency: "usd",
            minimum_units: 1,
            maximum_units: null,
            tiers: { type: "volume", tiers: [{ unit_amount: "2" }] },
          },
        ],
      } as unknown as models.Product),
    ).toBeNull()
  })

  test("a refunded credit pack removes its unspent balance once", async () => {
    const org = await newOrg()
    const customerId = randomUUID()
    const orderId = randomUUID()
    await db.insert(organizationWallets).values({
      organizationId: org,
      polarCustomerId: customerId,
    })
    const product = {
      id: "credits-pack",
      name: "Credits",
      metadata: {},
      is_recurring: false,
      prices: [
        {
          amount_type: "unit_based",
          is_archived: false,
          price_currency: "usd",
          minimum_units: 250,
          maximum_units: null,
          tiers: { type: "volume", tiers: [{ unit_amount: "2", bound: null }] },
        },
      ],
    } as unknown as models.Product
    const order = {
      id: orderId,
      paid: true,
      customer_id: customerId,
      product_id: product.id,
      product,
      units: 100,
      subscription_id: null,
      created_at: new Date().toISOString(),
      refunded_amount: 100,
      net_amount: 100,
    } as unknown as models.Order
    const client = {
      products: { get: async () => product },
      subscriptions: { get: async () => null as never },
    }
    await grantOrder(order, client)
    const reservation = await billing.reserve({
      organizationId: org,
      operation: "pack-spend",
      estimatedCredits: 30n,
      ttlMs: 60_000,
      idempotencyKey: randomUUID(),
    })
    await billing.settle({ reservationId: reservation.id, actualCredits: 30n })
    const payload = { data: order } as Parameters<typeof handleOrderRefunded>[0]
    await handleOrderRefunded(payload)
    await handleOrderRefunded(payload)
    expect(await billing.getBalance(org)).toBe(0n)
    expect(await countLedger(org, "refund")).toBe(1)
  })

  test("adds full upgrade credits after payment and resets the shared expiry", async () => {
    const org = await newOrg()
    const customerId = randomUUID()
    const subscriptionId = randomUUID()
    let periodStart = new Date(Date.now() - 86_400_000).toISOString()
    let periodEnd = new Date(Date.now() + 29 * 86_400_000).toISOString()
    await db
      .insert(organizationWallets)
      .values({ organizationId: org, polarCustomerId: customerId })
    let productId = "creator"
    const product = (id: string) =>
      ({
        id,
        name: id,
        metadata: { creditAmount: id === "creator" ? 100 : 200 },
        is_recurring: true,
        recurring_interval: "month",
        recurring_interval_count: 1,
        trial_interval: null,
      }) as unknown as models.Product
    const subscription = () =>
      ({
        id: subscriptionId,
        customer_id: customerId,
        product_id: productId,
        status: "active",
        current_period_start: periodStart,
        current_period_end: periodEnd,
        cancel_at_period_end: false,
        pending_update: null,
      }) as unknown as models.Subscription
    const client = {
      products: { get: async (id: string) => product(id) },
      subscriptions: { get: async () => subscription() },
    }
    const order = (id: string, reason: models.Order["billing_reason"]) =>
      ({
        id,
        paid: true,
        customer_id: customerId,
        product_id: productId,
        subscription_id: subscriptionId,
        billing_reason: reason,
        created_at: new Date().toISOString(),
        subscription: {
          current_period_start: periodStart,
          current_period_end: periodEnd,
        },
      }) as unknown as models.Order

    const initial = order(randomUUID(), "subscription_create")
    await grantOrder(initial, client)
    await grantOrder(initial, client)
    expect(await billing.getBalance(org)).toBe(100n)
    expect(
      (
        await db
          .select()
          .from(polarProcessedOrders)
          .where(eq(polarProcessedOrders.organizationId, org))
      ).length,
    ).toBe(1)

    const reservation = await billing.reserve({
      organizationId: org,
      operation: "generation-before-upgrade",
      estimatedCredits: 30n,
      ttlMs: 60_000,
      idempotencyKey: randomUUID(),
    })
    const oldPeriodEnd = (await wallet(org)).periodEnd
    productId = "studio"
    periodStart = new Date().toISOString()
    periodEnd = new Date(Date.now() + 30 * 86_400_000).toISOString()
    await syncSubscription(subscription())
    expect((await wallet(org)).pendingProductId).toBe("studio")
    expect((await wallet(org)).periodEnd?.getTime()).toBe(
      oldPeriodEnd?.getTime(),
    )
    expect(await billing.getBalance(org)).toBe(70n)
    const upgrade = order(randomUUID(), "subscription_update")
    await grantOrder(upgrade, client)
    await grantOrder(upgrade, client)
    expect(await billing.getBalance(org)).toBe(270n)
    expect((await getBillingForTest(org))?.allowance).toBe(200n)
    expect((await wallet(org)).balanceExpiresAt?.getTime()).toBe(
      new Date(periodEnd).getTime(),
    )
    expect((await wallet(org)).pendingProductId).toBeNull()
    await billing.refund(reservation.id)
    expect(await billing.getBalance(org)).toBe(300n)
    const refundedUpgrade = {
      ...upgrade,
      refunded_amount: 2000,
      net_amount: 2000,
    } as models.Order
    await handleOrderRefunded({ data: refundedUpgrade } as Parameters<
      typeof handleOrderRefunded
    >[0])
    await handleOrderRefunded({ data: refundedUpgrade } as Parameters<
      typeof handleOrderRefunded
    >[0])
    expect(await billing.getBalance(org)).toBe(100n)
  })

  test("does not advance the paid snapshot or grant credits for an unpaid reset", async () => {
    const org = await newOrg()
    const customerId = randomUUID()
    const originalStart = new Date(Date.now() - 86_400_000)
    const originalEnd = new Date(Date.now() + 29 * 86_400_000)
    await db.insert(organizationWallets).values({
      organizationId: org,
      polarCustomerId: customerId,
      polarSubscriptionId: randomUUID(),
      productId: "starter",
      productName: "Starter",
      allowance: 100n,
      status: "active",
      periodStart: originalStart,
      periodEnd: originalEnd,
    })
    await billing.grantSubscriptionCredits({
      organizationId: org,
      amount: 100n,
      periodEnd: originalEnd,
      idempotencyKey: randomUUID(),
    })
    await syncSubscription({
      id: (await wallet(org)).polarSubscriptionId,
      customer_id: customerId,
      product_id: "pro",
      status: "past_due",
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      cancel_at_period_end: false,
      pending_update: null,
    } as models.Subscription)
    const pending = await wallet(org)
    expect(pending.productId).toBe("starter")
    expect(pending.pendingProductId).toBe("pro")
    expect(pending.periodStart?.getTime()).toBe(originalStart.getTime())
    expect(pending.periodEnd?.getTime()).toBe(originalEnd.getTime())
    expect(pending.balanceExpiresAt?.getTime()).toBe(originalEnd.getTime())
    expect(await billing.getBalance(org)).toBe(100n)
  })

  test("a scheduled downgrade grants the next plan only after its paid cycle", async () => {
    const org = await newOrg()
    const customerId = randomUUID()
    const subscriptionId = randomUUID()
    const oldStart = new Date(Date.now() - 30 * 86_400_000)
    const oldEnd = new Date(Date.now() - 1000)
    await db.insert(organizationWallets).values({
      organizationId: org,
      polarCustomerId: customerId,
      polarSubscriptionId: subscriptionId,
      productId: "pro",
      productName: "Pro",
      allowance: 200n,
      status: "active",
      periodStart: oldStart,
      periodEnd: oldEnd,
      balance: 200n,
      balanceExpiresAt: oldEnd,
    })
    const nextStart = new Date().toISOString()
    const nextEnd = new Date(Date.now() + 30 * 86_400_000).toISOString()
    const subscription = {
      id: subscriptionId,
      customer_id: customerId,
      product_id: "starter",
      status: "active",
      current_period_start: nextStart,
      current_period_end: nextEnd,
      cancel_at_period_end: false,
      pending_update: null,
    } as models.Subscription
    await syncSubscription(subscription)
    expect((await wallet(org)).productId).toBe("pro")
    expect((await wallet(org)).periodEnd?.getTime()).toBe(oldEnd.getTime())
    const order = {
      id: randomUUID(),
      paid: true,
      customer_id: customerId,
      product_id: "starter",
      subscription_id: subscriptionId,
      billing_reason: "subscription_cycle",
      created_at: nextStart,
      subscription: {
        current_period_start: nextStart,
        current_period_end: nextEnd,
      },
    } as models.Order
    const product = {
      id: "starter",
      name: "Starter",
      metadata: { creditAmount: 100, planTier: 1 },
      is_recurring: true,
      recurring_interval: "month",
      recurring_interval_count: 1,
    } as unknown as models.Product
    await grantOrder(order, {
      products: { get: async () => product },
      subscriptions: { get: async () => subscription },
    })
    expect((await wallet(org)).productId).toBe("starter")
    expect((await wallet(org)).balanceExpiresAt?.getTime()).toBe(
      new Date(nextEnd).getTime(),
    )
    expect(await billing.getBalance(org)).toBe(100n)
  })

  test("keeps prorated credits for an in-flight invoice upgrade", async () => {
    const org = await newOrg()
    const customerId = randomUUID()
    const subscriptionId = randomUUID()
    const periodStart = new Date(Date.now() - 15 * 86_400_000)
    const periodEnd = new Date(Date.now() + 15 * 86_400_000)
    await db.insert(organizationWallets).values({
      organizationId: org,
      polarCustomerId: customerId,
      polarSubscriptionId: subscriptionId,
      productId: "starter",
      allowance: 100n,
      status: "active",
      periodStart,
      periodEnd,
    })
    const subscription = {
      id: subscriptionId,
      customer_id: customerId,
      product_id: "pro",
      status: "active",
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
      cancel_at_period_end: false,
      pending_update: null,
    } as models.Subscription
    const order = {
      id: randomUUID(),
      paid: true,
      customer_id: customerId,
      product_id: "pro",
      subscription_id: subscriptionId,
      billing_reason: "subscription_update",
      created_at: new Date().toISOString(),
      subscription: {
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
      },
    } as models.Order
    const product = {
      id: "pro",
      name: "Pro",
      metadata: { creditAmount: 200 },
      is_recurring: true,
      recurring_interval: "month",
      recurring_interval_count: 1,
    } as unknown as models.Product
    await grantOrder(order, {
      products: { get: async () => product },
      subscriptions: { get: async () => subscription },
    })
    const granted = (await wallet(org)).balance
    expect(granted).toBeGreaterThan(0n)
    expect(granted).toBeLessThan(100n)
    expect((await wallet(org)).balanceExpiresAt?.getTime()).toBe(
      periodEnd.getTime(),
    )
  })
})

async function getBillingForTest(organizationId: string) {
  const [row] = await db
    .select()
    .from(organizationWallets)
    .where(eq(organizationWallets.organizationId, organizationId))
    .limit(1)
  return row ?? null
}

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

  test("persists providerCostUsd, chargedCredits, and chargedCostUsd in reservation and ledger metadata across under-spend, exact-spend, and overage", async () => {
    const org = await newOrg()
    await seedBalance(org, 300n)

    // 1. Under-spend with defined providerCostUsd
    const underRes = await billing.reserve({
      organizationId: org,
      operation: "test.meta.under",
      estimatedCredits: 100n,
      ttlMs: 60_000,
      idempotencyKey: `r:${randomUUID()}`,
      metadata: { requestId: "req-1" },
    })
    const settledUnder = await billing.settle({
      reservationId: underRes.id,
      actualCredits: 60n,
      providerCostUsd: 0.144,
      metadata: { vendor: "wavespeed" },
    })
    expect(settledUnder.metadata).toEqual({
      requestId: "req-1",
      vendor: "wavespeed",
      providerCostUsd: 0.144,
      chargedCredits: 60,
      chargedCostUsd: 0.18,
    })
    const [underLedger] = await db
      .select()
      .from(billingLedger)
      .where(
        and(
          eq(billingLedger.reservationId, underRes.id),
          eq(billingLedger.kind, "settle_diff"),
        ),
      )
    expect(underLedger.metadata).toEqual({
      vendor: "wavespeed",
      providerCostUsd: 0.144,
      chargedCredits: 60,
      chargedCostUsd: 0.18,
    })

    // 2. Exact-spend (diff === 0n) with undefined providerCostUsd
    const exactRes = await billing.reserve({
      organizationId: org,
      operation: "test.meta.exact",
      estimatedCredits: 50n,
      ttlMs: 60_000,
      idempotencyKey: `r:${randomUUID()}`,
      metadata: { requestId: "req-2" },
    })
    const settledExact = await billing.settle({
      reservationId: exactRes.id,
      actualCredits: 50n,
      providerCostUsd: undefined,
      metadata: { vendor: "replicate" },
    })
    expect(settledExact.metadata).toEqual({
      requestId: "req-2",
      vendor: "replicate",
      chargedCredits: 50,
      chargedCostUsd: 0.15,
    })
    expect("providerCostUsd" in (settledExact.metadata ?? {})).toBe(false)

    // 3. Uncovered overage (wallet has 300 - 60 - 50 = 190 left; reserve 100 -> 90 left; settle 250 -> debits 90, uncovered 60 -> chargedCredits = 190)
    const overageRes = await billing.reserve({
      organizationId: org,
      operation: "test.meta.overage",
      estimatedCredits: 100n,
      ttlMs: 60_000,
      idempotencyKey: `r:${randomUUID()}`,
    })
    const settledOverage = await billing.settle({
      reservationId: overageRes.id,
      actualCredits: 250n,
      providerCostUsd: 0.6,
      metadata: { vendor: "openrouter" },
    })
    expect(settledOverage.metadata).toEqual({
      vendor: "openrouter",
      providerCostUsd: 0.6,
      chargedCredits: 190,
      chargedCostUsd: 0.57,
    })
    const [overageLedger] = await db
      .select()
      .from(billingLedger)
      .where(
        and(
          eq(billingLedger.reservationId, overageRes.id),
          eq(billingLedger.kind, "overage_uncovered"),
        ),
      )
    expect(overageLedger.metadata).toEqual({
      vendor: "openrouter",
      providerCostUsd: 0.6,
      chargedCredits: 190,
      chargedCostUsd: 0.57,
      uncovered: "60",
    })
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

  test("forwards providerCostUsd and execution metadata from withBilling and withBillingStream", async () => {
    const org = await newOrg()
    await seedBalance(org, 500n)

    let syncReservationId = ""
    const syncBillable = makeBillable<void, string>({
      operation: "test.sync.meta",
      estimateCost: () => 50n,
      execute: async (_input, ctx) => {
        syncReservationId = ctx.reservationId
        return {
          output: "done",
          actualCredits: 40n,
          providerCostUsd: 0.096,
          metadata: { vendor: "openrouter", modelId: "gpt-test" },
        }
      },
    })
    const runSync = withBilling(syncBillable, billing)
    await runSync(undefined as void, {
      organizationId: org,
      metadata: { runId: "run-sync" },
    })
    const syncRes = await billing.getReservation(syncReservationId)
    expect(syncRes?.metadata).toEqual({
      runId: "run-sync",
      vendor: "openrouter",
      modelId: "gpt-test",
      providerCostUsd: 0.096,
      chargedCredits: 40,
      chargedCostUsd: 0.12,
    })

    const streamBillable: BillableStream<void, { done: boolean }> = {
      operation: "test.stream.meta",
      timeoutMs: 5_000,
      ttlMs: 60_000,
      estimateCost: () => 30n,
      idempotencyKey: () => `stream:${randomUUID()}`,
      async *stream() {
        yield { done: false }
        yield { done: true }
      },
      terminalCredits: (chunk) => (chunk.done ? 20n : null),
      terminalSettlement: (chunk) =>
        chunk.done
          ? {
              actualCredits: 20n,
              providerCostUsd: undefined,
              metadata: { vendor: "vercel-gateway" },
            }
          : null,
    }
    const runStream = withBillingStream(streamBillable, billing)
    const chunks: Array<{ done: boolean }> = []
    for await (const chunk of runStream(undefined as void, {
      organizationId: org,
      metadata: { sessionId: "sess-1" },
    })) {
      chunks.push(chunk)
    }
    expect(chunks).toHaveLength(2)
    const [streamRes] = await db
      .select()
      .from(billingReservations)
      .where(
        and(
          eq(billingReservations.organizationId, org),
          eq(billingReservations.operation, "test.stream.meta"),
        ),
      )
    expect(streamRes.metadata).toEqual({
      sessionId: "sess-1",
      vendor: "vercel-gateway",
      chargedCredits: 20,
      chargedCostUsd: 0.06,
    })
    expect("providerCostUsd" in (streamRes.metadata ?? {})).toBe(false)
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
  })
})

describe("pooled PAYG credits", () => {
  const reserveCredits = (organizationId: string, estimatedCredits: bigint) =>
    billing.reserve({
      organizationId,
      operation: "test.payg",
      estimatedCredits,
      ttlMs: 60_000,
      idempotencyKey: `payg-reservation:${randomUUID()}`,
    })

  test("grant is idempotent and renews the entire pool", async () => {
    const org = await newOrg()
    const key = randomUUID()
    await seedPayg(org, 100n, key)
    const first = await wallet(org)
    expect(first.paygBalanceExpiresAt!.getTime()).toBeGreaterThan(
      Date.now() + 364 * 86400_000,
    )
    await seedPayg(org, 100n, key)
    await seedPayg(org, 50n)
    const renewed = await wallet(org)
    expect(renewed.paygBalance).toBe(150n)
    expect(renewed.paygBalanceExpiresAt!.getTime()).toBeGreaterThanOrEqual(
      first.paygBalanceExpiresAt!.getTime(),
    )
    expect(renewed.paygGeneration).toBe(first.paygGeneration)
    expect(await ledgerTotal(org)).toBe(150n)
  })

  test("reusing a grant key for a different grant is rejected", async () => {
    const org = await newOrg()
    const key = `shared:${randomUUID()}`
    await billing.grantPaygCredits({
      organizationId: org,
      amount: 30n,
      idempotencyKey: key,
    })
    await expect(
      billing.grantPaygCredits({
        organizationId: org,
        amount: 40n,
        idempotencyKey: key,
      }),
    ).rejects.toThrow()
    await expect(
      billing.topup({ organizationId: org, amount: 30n, idempotencyKey: key }),
    ).rejects.toThrow()
    expect(await billing.getBalance(org)).toBe(30n)
  })

  test("reserves subscription first, then PAYG; settlement refunds PAYG first", async () => {
    const org = await newOrg()
    await seedBalance(org, 80n)
    await seedPayg(org, 100n)
    const reservation = await reserveCredits(org, 120n)
    expect(reservation.balanceReserved).toBe(80n)
    expect(reservation.paygReserved).toBe(40n)
    expect(await billing.getBalances(org)).toMatchObject({
      balance: 60n,
      subscriptionBalance: 0n,
      paygBalance: 60n,
    })
    await billing.settle({ reservationId: reservation.id, actualCredits: 90n })
    expect((await wallet(org)).paygBalance).toBe(90n)
    expect(await ledgerTotal(org)).toBe(await billing.getBalance(org))
  })

  test("insufficient combined balance rolls back; overage drains both sources", async () => {
    const org = await newOrg()
    await seedBalance(org, 20n)
    await seedPayg(org, 30n)
    await expect(reserveCredits(org, 51n)).rejects.toBeInstanceOf(
      InsufficientCreditsError,
    )
    expect(await billing.getBalance(org)).toBe(50n)
    const reservation = await reserveCredits(org, 10n)
    await billing.settle({ reservationId: reservation.id, actualCredits: 70n })
    expect(await billing.getBalance(org)).toBe(0n)
    expect(await countLedger(org, "overage_uncovered")).toBe(1)
    expect(await ledgerTotal(org)).toBe(0n)
  })

  test("expiry boundary clears a pool and prevents spending", async () => {
    const org = await newOrg()
    await seedPayg(org, 25n)
    await expirePayg(org)
    expect(await billing.getBalance(org)).toBe(0n)
    await expect(reserveCredits(org, 1n)).rejects.toBeInstanceOf(
      InsufficientCreditsError,
    )
    expect((await wallet(org)).paygBalance).toBe(0n)
    expect(await ledgerTotal(org)).toBe(0n)
  })

  test("idle wallet sweep expires due credits once", async () => {
    const org = await newOrg()
    await seedPayg(org, 25n)
    await expirePayg(org)
    expect(await billing.sweepExpiredWallets()).toBeGreaterThanOrEqual(1)
    expect(await billing.sweepExpiredWallets()).toBe(0)
    expect((await wallet(org)).paygBalance).toBe(0n)
    expect(await ledgerTotal(org)).toBe(0n)
  })

  test("a new purchase extends the expiry of the entire PAYG pool", async () => {
    const org = await newOrg()
    await billing.grantPaygCredits({
      organizationId: org,
      amount: 100n,
      idempotencyKey: `payg:${randomUUID()}`,
      purchasedAt: new Date(Date.now() - 30 * 86_400_000),
    })
    const firstExpiry = (await wallet(org)).paygBalanceExpiresAt!
    await billing.grantPaygCredits({
      organizationId: org,
      amount: 200n,
      idempotencyKey: `payg:${randomUUID()}`,
    })
    const current = await wallet(org)
    expect(current.paygBalance).toBe(300n)
    expect(current.paygBalanceExpiresAt!.getTime()).toBeGreaterThan(
      firstExpiry.getTime(),
    )
    expect(await ledgerTotal(org)).toBe(300n)
  })

  test("subscription grant expires at its paid period end", async () => {
    const org = await newOrg()
    await billing.grantSubscriptionCredits({
      organizationId: org,
      amount: 80n,
      periodEnd: new Date(Date.now() + 86_400_000),
      idempotencyKey: `period:${org}`,
    })
    expect(await billing.getBalance(org)).toBe(80n)
    await billing.expireSubscriptionCredits(org)
    expect(await billing.getBalance(org)).toBe(0n)
  })

  test("grant after expiry starts a new generation; old refund is discarded", async () => {
    const org = await newOrg()
    await seedPayg(org, 100n)
    const reservation = await reserveCredits(org, 40n)
    await expirePayg(org)
    await seedPayg(org, 20n)
    expect((await wallet(org)).paygGeneration).toBe(
      reservation.paygGeneration + 1n,
    )
    await billing.refund(reservation.id)
    expect((await wallet(org)).paygBalance).toBe(20n)
    expect(await ledgerTotal(org)).toBe(20n)
  })

  test("refund after renewal returns to the live PAYG pool once", async () => {
    const org = await newOrg()
    await seedPayg(org, 100n)
    const reservation = await reserveCredits(org, 40n)
    await seedPayg(org, 20n)
    await billing.refund(reservation.id)
    await billing.refund(reservation.id)
    expect((await wallet(org)).paygBalance).toBe(120n)
    expect(await countLedger(org, "refund")).toBe(1)
  })

  test("settlement after PAYG expiry discards the expired refund", async () => {
    const org = await newOrg()
    await seedPayg(org, 100n)
    const reservation = await reserveCredits(org, 80n)
    await expirePayg(org)
    await billing.settle({ reservationId: reservation.id, actualCredits: 20n })
    expect(await billing.getBalance(org)).toBe(0n)
    expect(await ledgerTotal(org)).toBe(0n)
  })

  test("expired subscription credits cannot return to a replacement generation", async () => {
    const org = await newOrg()
    await seedBalance(org, 100n)
    await db
      .update(organizationWallets)
      .set({ balanceExpiresAt: new Date(Date.now() + 60_000) })
      .where(eq(organizationWallets.organizationId, org))
    const reservation = await reserveCredits(org, 40n)
    await db
      .update(organizationWallets)
      .set({ balanceExpiresAt: new Date(0) })
      .where(eq(organizationWallets.organizationId, org))
    await billing.getBalance(org)
    await db
      .update(organizationWallets)
      .set({ balance: 50n, balanceExpiresAt: new Date(Date.now() + 60_000) })
      .where(eq(organizationWallets.organizationId, org))
    await billing.refund(reservation.id)
    expect((await wallet(org)).balance).toBe(50n)
  })

  test("reservation sweeper refunds live sources and remains idempotent", async () => {
    const org = await newOrg()
    await seedBalance(org, 20n)
    await seedPayg(org, 30n)
    const reservation = await reserveCredits(org, 40n)
    await db
      .update(billingReservations)
      .set({ expiresAt: new Date(0) })
      .where(eq(billingReservations.id, reservation.id))
    expect(await billing.sweepExpired()).toBeGreaterThanOrEqual(1)
    expect(await billing.getBalance(org)).toBe(50n)
    await expect(
      billing.settle({ reservationId: reservation.id, actualCredits: 1n }),
    ).rejects.toBeInstanceOf(ReservationExpiredError)
  })

  test("concurrent reservations and duplicate grants do not overspend", async () => {
    const org = await newOrg()
    await seedPayg(org, 100n)
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => reserveCredits(org, 20n)),
    )
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(5)
    expect(await billing.getBalance(org)).toBe(0n)
    const key = randomUUID()
    await Promise.all(Array.from({ length: 5 }, () => seedPayg(org, 20n, key)))
    expect(await billing.getBalance(org)).toBe(20n)
    expect(await ledgerTotal(org)).toBe(20n)
  })

  test("a grant racing reservations preserves the ledger and wallet total", async () => {
    const org = await newOrg()
    await seedPayg(org, 40n)
    const operations = await Promise.allSettled([
      seedPayg(org, 30n),
      reserveCredits(org, 30n),
      reserveCredits(org, 30n),
    ])
    const reservations = operations
      .slice(1)
      .filter((result) => result.status === "fulfilled").length
    expect(operations[0].status).toBe("fulfilled")
    expect(await billing.getBalance(org)).toBe(70n - BigInt(reservations * 30))
    expect(await ledgerTotal(org)).toBe(await billing.getBalance(org))
  })
})
