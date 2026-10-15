import { db } from "@/db"
import {
  member,
  organization,
  organizationWallets,
  polarProcessedOrders,
  user,
} from "@/db/schema"
import { and, eq } from "drizzle-orm"
import type { models, webhooks } from "@polar-sh/sdk/2026-10"
import { BadRequest } from "@/features/error"
import { billingService } from "./service"
import { requirePolar } from "./polar-client"

type Product = models.Product
type Subscription = models.Subscription
type Order = models.Order
type BillingPolarClient = {
  products: Pick<ReturnType<typeof requirePolar>["products"], "get">
  subscriptions: Pick<ReturnType<typeof requirePolar>["subscriptions"], "get">
}

export function creditAmount(metadata: Record<string, unknown>): number | null {
  const raw = metadata.creditAmount
  const amount =
    typeof raw === "string" && /^[1-9]\d*$/.test(raw) ? Number(raw) : raw
  return typeof amount === "number" &&
    Number.isSafeInteger(amount) &&
    amount > 0
    ? amount
    : null
}

export function planTier(metadata: Record<string, unknown>): number | null {
  const raw = metadata.planTier
  const tier =
    typeof raw === "string" && /^[1-9]\d*$/.test(raw) ? Number(raw) : raw
  return typeof tier === "number" && Number.isSafeInteger(tier) && tier > 0
    ? tier
    : null
}

export function planChangeBehavior(currentTier: number, nextTier: number) {
  if (nextTier === currentTier) return null
  return nextTier > currentTier ? "reset" : "next_period"
}

function productKind(
  product: Product,
  availableOnly = true,
): "plan" | "pack" | null {
  if (
    !creditAmount(product.metadata) ||
    (availableOnly && (product.is_archived || product.visibility !== "public"))
  )
    return null
  if (
    product.recurring_interval === "month" &&
    product.recurring_interval_count === 1 &&
    !product.trial_interval &&
    planTier(product.metadata)
  )
    return "plan"
  if (!product.is_recurring) return "pack"
  return null
}

export async function catalog() {
  const products: Product[] = []
  for await (const product of requirePolar().products.iterList({
    is_archived: false,
    visibility: ["public"],
    limit: 100,
  }))
    products.push(product)
  return products
    .filter((product) => productKind(product) !== null)
    .map((product) => {
      const price = product.prices.find(
        (candidate) =>
          candidate.amount_type === "fixed" &&
          !candidate.is_archived &&
          candidate.price_amount > 0,
      )
      return {
        id: product.id,
        name: product.name,
        description: product.description,
        kind: productKind(product)!,
        credits: creditAmount(product.metadata)!,
        planTier:
          productKind(product) === "plan" ? planTier(product.metadata) : null,
        priceAmount: price?.amount_type === "fixed" ? price.price_amount : null,
        currency: price?.amount_type === "fixed" ? price.price_currency : null,
      }
    })
    .filter((product) => product.priceAmount !== null)
}

export async function getCatalogProduct(id: string, kind: "plan" | "pack") {
  const product = await requirePolar().products.get(id)
  if (
    productKind(product) !== kind ||
    !product.prices.some(
      (price) =>
        price.amount_type === "fixed" &&
        !price.is_archived &&
        price.price_amount > 0,
    )
  ) {
    throw new BadRequest("Product is not available for this purchase")
  }
  return product
}

export async function getBilling(organizationId: string) {
  const [row] = await db
    .select()
    .from(organizationWallets)
    .where(eq(organizationWallets.organizationId, organizationId))
    .limit(1)
  return row ?? null
}

export function hasPaidAccess(row: Awaited<ReturnType<typeof getBilling>>) {
  return (
    !!row &&
    !!row.productId &&
    !!row.allowance &&
    (["active", "past_due"].includes(row.status) ||
      (row.status === "canceled" && row.cancelAtPeriodEnd)) &&
    !!row.periodEnd &&
    row.periodEnd > new Date()
  )
}

export async function ensurePolarCustomer(organizationId: string) {
  const existing = await getBilling(organizationId)
  if (existing?.polarCustomerId) return existing.polarCustomerId
  const [org] = await db
    .select()
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1)
  if (!org) throw new Error("Organization not found")
  const [owner] = await db
    .select({ email: user.email, name: user.name, id: user.id })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(
      and(eq(member.organizationId, organizationId), eq(member.role, "owner")),
    )
    .limit(1)
  if (!owner) throw new Error("Organization owner not found")
  let customer: models.Customer
  try {
    customer = await requirePolar().customers.getExternal(organizationId)
  } catch {
    customer = await requirePolar().customers.create({
      type: "team",
      external_id: organizationId,
      name: org.name,
      owner: { email: owner.email, name: owner.name, external_id: owner.id },
    })
  }
  await db
    .insert(organizationWallets)
    .values({ organizationId, polarCustomerId: customer.id })
    .onConflictDoUpdate({
      target: organizationWallets.organizationId,
      set: { polarCustomerId: customer.id, updatedAt: new Date() },
    })
  return customer.id
}

export async function syncSubscription(subscription: Subscription) {
  const [row] = await db
    .select()
    .from(organizationWallets)
    .where(eq(organizationWallets.polarCustomerId, subscription.customer_id))
    .limit(1)
  if (!row)
    throw new Error(`Unknown Polar customer ${subscription.customer_id}`)
  const paidProductConfirmed = row.productId === subscription.product_id
  await db
    .update(organizationWallets)
    .set({
      polarSubscriptionId: subscription.id,
      status: subscription.status,
      periodStart: paidProductConfirmed
        ? new Date(subscription.current_period_start)
        : row.periodStart,
      periodEnd: paidProductConfirmed
        ? new Date(subscription.current_period_end)
        : row.periodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      pendingProductId:
        subscription.pending_update?.product_id ??
        (paidProductConfirmed ? null : subscription.product_id),
      updatedAt: new Date(),
    })
    .where(eq(organizationWallets.organizationId, row.organizationId))
  if (
    ["canceled", "unpaid"].includes(subscription.status) &&
    (!subscription.cancel_at_period_end ||
      new Date(subscription.current_period_end) <= new Date())
  ) {
    await billingService.expireSubscriptionCredits(row.organizationId)
  }
}

export async function syncPolarSubscription(id: string) {
  await syncSubscription(await requirePolar().subscriptions.get(id))
}

export async function grantOrder(
  order: Order,
  client: BillingPolarClient = requirePolar(),
) {
  if (!order.paid) throw new Error("Cannot grant credits for an unpaid order")
  const [billing] = await db
    .select()
    .from(organizationWallets)
    .where(eq(organizationWallets.polarCustomerId, order.customer_id))
    .limit(1)
  if (!billing || !order.product_id)
    throw new Error(`Unmapped Polar order ${order.id}`)
  const [processed] = await db
    .select()
    .from(polarProcessedOrders)
    .where(eq(polarProcessedOrders.orderId, order.id))
    .limit(1)
  if (processed) return
  const product = order.product ?? (await client.products.get(order.product_id))
  const amount = creditAmount(product.metadata)
  if (!amount)
    throw new Error(`Invalid creditAmount on Polar product ${product.id}`)
  let credits = amount
  const kind = order.subscription_id
    ? product.recurring_interval === "month" &&
      product.recurring_interval_count === 1
      ? "plan"
      : null
    : !product.is_recurring
      ? "pack"
      : null
  if (!kind) throw new Error(`Unsupported Polar product ${product.id}`)
  if (kind === "pack") {
    const purchasedAt = new Date(order.created_at)
    const expiresAt = new Date(purchasedAt)
    expiresAt.setUTCFullYear(expiresAt.getUTCFullYear() + 1)
    if (expiresAt <= new Date()) credits = 0
    else
      await billingService.grantPaygCredits({
        organizationId: billing.organizationId,
        amount: BigInt(credits),
        purchasedAt,
        idempotencyKey: `polar:order:${order.id}`,
        metadata: { productId: product.id },
      })
  } else {
    if (!order.subscription_id)
      throw new Error(`Subscription order ${order.id} has no subscription`)
    const subscription = await client.subscriptions.get(order.subscription_id)
    if (subscription.customer_id !== billing.polarCustomerId)
      throw new Error("Polar subscription/order mismatch")
    const periodEnd = new Date(
      order.subscription?.current_period_end ?? subscription.current_period_end,
    )
    const periodStart = new Date(
      order.subscription?.current_period_start ??
        subscription.current_period_start,
    )
    const historicalPeriod =
      !!billing.periodStart && periodStart < billing.periodStart
    if (historicalPeriod) credits = 0
    if (
      order.billing_reason === "subscription_update" &&
      billing.periodStart &&
      periodStart.getTime() <= billing.periodStart.getTime()
    ) {
      const previous = Number(billing.allowance ?? 0n)
      const remainingMs = Math.max(
        0,
        periodEnd.getTime() - new Date(order.created_at).getTime(),
      )
      const periodMs = periodEnd.getTime() - periodStart.getTime()
      credits =
        !historicalPeriod && periodMs > 0
          ? Math.floor(
              (Math.max(0, amount - previous) * remainingMs) / periodMs,
            )
          : 0
    }
    if (credits > 0 && periodEnd > new Date())
      await billingService.grantSubscriptionCredits({
        organizationId: billing.organizationId,
        amount: BigInt(credits),
        periodEnd,
        idempotencyKey: `polar:order:${order.id}`,
        metadata: {
          productId: product.id,
          periodStart: subscription.current_period_start,
        },
      })
    if (!historicalPeriod)
      await db
        .update(organizationWallets)
        .set({
          polarSubscriptionId: subscription.id,
          productId: product.id,
          productName: product.name,
          allowance: BigInt(amount),
          status: subscription.status,
          periodStart,
          periodEnd,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          pendingProductId: subscription.pending_update?.product_id ?? null,
          updatedAt: new Date(),
        })
        .where(eq(organizationWallets.organizationId, billing.organizationId))
  }
  await db
    .insert(polarProcessedOrders)
    .values({
      orderId: order.id,
      organizationId: billing.organizationId,
      productId: product.id,
      creditsGranted: BigInt(credits),
      kind,
    })
    .onConflictDoNothing()
}

export async function handleOrderPaid(
  payload: webhooks.WebhookOrderPaidPayload,
) {
  if (payload.data.paid) await grantOrder(payload.data)
}

export async function handleOrderRefunded(
  payload: webhooks.WebhookOrderRefundedPayload,
) {
  const order = payload.data
  if (order.refunded_amount < order.net_amount) return
  const [processed] = await db
    .select()
    .from(polarProcessedOrders)
    .where(eq(polarProcessedOrders.orderId, order.id))
    .limit(1)
  if (!processed) {
    const [billing] = await db
      .select()
      .from(organizationWallets)
      .where(eq(organizationWallets.polarCustomerId, order.customer_id))
      .limit(1)
    if (billing && order.product_id)
      await db
        .insert(polarProcessedOrders)
        .values({
          orderId: order.id,
          organizationId: billing.organizationId,
          productId: order.product_id,
          creditsGranted: 0n,
          kind: order.subscription_id ? "plan" : "pack",
          refunded: true,
        })
        .onConflictDoNothing()
    return
  }
  if (processed.refunded) return
  if (processed.kind === "pack")
    await billingService.revokePaygGrant({
      organizationId: processed.organizationId,
      sourceKey: `polar:order:${order.id}`,
      idempotencyKey: `polar:order:${order.id}:refund`,
    })
  else {
    const current = await getBilling(processed.organizationId)
    const refundedPeriod = order.subscription?.current_period_start
    if (
      current?.periodStart &&
      refundedPeriod &&
      current.periodStart.getTime() === new Date(refundedPeriod).getTime()
    ) {
      await billingService.revokeSubscriptionGrant({
        organizationId: processed.organizationId,
        sourceKey: `polar:order:${order.id}`,
        idempotencyKey: `polar:order:${order.id}:refund`,
      })
    }
  }
  await db
    .update(polarProcessedOrders)
    .set({ refunded: true })
    .where(
      and(
        eq(polarProcessedOrders.orderId, order.id),
        eq(polarProcessedOrders.refunded, false),
      ),
    )
}

export async function reconcileOrganization(organizationId: string) {
  const billing = await getBilling(organizationId)
  if (!billing?.polarCustomerId) return
  if (billing.polarSubscriptionId) {
    await syncSubscription(
      await requirePolar().subscriptions.get(billing.polarSubscriptionId),
    )
  }
  for await (const order of requirePolar().orders.iterList({
    customer_id: billing.polarCustomerId,
    status: "paid",
    limit: 100,
  })) {
    await grantOrder(order)
  }
}
