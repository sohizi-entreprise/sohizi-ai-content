import { Elysia } from "elysia"
import Stripe from "stripe"
import { and, eq, isNull } from "drizzle-orm"
import { db } from "@/db"
import { organizationWallets } from "@/db/schema"
import { BadRequest, Forbidden } from "@/features/error"
import { billingService } from "./service"
import { configuredPrices, requireStripe } from "./stripe-client"

const MAX_CREDITS = 50_000
const priceId = (price: Stripe.Price) =>
  typeof price.product === "string" ? price.product : price.product.id
const id = (value: string | { id: string } | null) =>
  typeof value === "string" ? value : (value?.id ?? null)
const int = (value: string | undefined) =>
  value && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value))
    ? Number(value)
    : null

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
    !!row?.productId &&
    !!row.allowance &&
    !!row.periodEnd &&
    row.periodEnd > new Date() &&
    (["active", "past_due"].includes(row.status) ||
      (row.status === "canceled" && row.cancelAtPeriodEnd))
  )
}

async function products() {
  const stripe = requireStripe()
  const prices = configuredPrices()
  return Promise.all(
    Object.entries(prices).map(async ([key, stripePriceId]) => {
      const price = await stripe.prices.retrieve(stripePriceId)
      const product = await stripe.products.retrieve(priceId(price))
      if (
        !price.active ||
        !product.active ||
        price.unit_amount == null ||
        price.unit_amount <= 0 ||
        !product.tax_code
      )
        throw new Error(`Invalid Stripe catalog entry ${stripePriceId}`)
      const kind = key === "credits" ? "pack" : "plan"
      if (
        kind === "pack"
          ? !!price.recurring
          : price.recurring?.interval !== "month" ||
            price.recurring.interval_count !== 1
      )
        throw new Error(`Invalid billing interval on ${stripePriceId}`)
      const credits =
        kind === "plan" ? int(product.metadata.creditAmount) : null
      const planTier = kind === "plan" ? int(product.metadata.planTier) : null
      const minimumUnits =
        kind === "pack" ? int(product.metadata.minimumUnits) : null
      if (
        (kind === "plan" && (!credits || !planTier)) ||
        (kind === "pack" && (!minimumUnits || minimumUnits > MAX_CREDITS))
      )
        throw new Error(`Invalid Stripe product metadata ${product.id}`)
      return {
        id: product.id,
        priceId: price.id,
        name: product.name,
        description: product.description,
        kind,
        credits,
        planTier,
        priceAmount: kind === "plan" ? price.unit_amount : null,
        currency: price.currency,
        unitAmount: kind === "pack" ? price.unit_amount : null,
        minimumUnits,
        maximumUnits: kind === "pack" ? MAX_CREDITS : null,
        metadata: product.metadata,
      }
    }),
  )
}

export async function catalog() {
  return (await products()).map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    kind: item.kind,
    credits: item.credits,
    planTier: item.planTier,
    priceAmount: item.priceAmount,
    currency: item.currency,
    unitAmount: item.unitAmount,
    minimumUnits: item.minimumUnits,
    maximumUnits: item.maximumUnits,
  }))
}

export async function getCatalogProduct(
  productId: string,
  kind: "plan" | "pack",
) {
  const product = (await products()).find(
    (item) => item.id === productId && item.kind === kind,
  )
  if (!product)
    throw new BadRequest("Product is not available for this purchase")
  return product
}

async function ensureCustomer(organizationId: string, email?: string) {
  const stripe = requireStripe()
  await db
    .insert(organizationWallets)
    .values({ organizationId })
    .onConflictDoNothing()
  const wallet = await getBilling(organizationId)
  if (wallet?.stripeCustomerId) {
    if (email) {
      const existing = await stripe.customers.retrieve(wallet.stripeCustomerId)
      if (!existing.deleted && !existing.email) {
        await stripe.customers.update(wallet.stripeCustomerId, { email })
      }
    }
    return wallet.stripeCustomerId
  }
  const customer = await stripe.customers.create(
    { ...(email ? { email } : {}), metadata: { organizationId } },
    { idempotencyKey: `sohizi:customer:${organizationId}` },
  )
  const [updated] = await db
    .update(organizationWallets)
    .set({ stripeCustomerId: customer.id })
    .where(
      and(
        eq(organizationWallets.organizationId, organizationId),
        isNull(organizationWallets.stripeCustomerId),
      ),
    )
    .returning({ stripeCustomerId: organizationWallets.stripeCustomerId })
  const customerId =
    updated?.stripeCustomerId ??
    (await getBilling(organizationId))?.stripeCustomerId ??
    customer.id
  if (email && customerId === customer.id && !customer.email) {
    await stripe.customers.update(customerId, { email })
  }
  return customerId
}

function billingUrl() {
  if (!process.env.FRONTEND_URL)
    throw new Error("FRONTEND_URL is required for billing")
  return new URL("/account/billing", process.env.FRONTEND_URL).toString()
}

export async function checkout(
  organizationId: string,
  productId: string,
  kind: "plan" | "pack",
  units?: number,
  email?: string,
) {
  const product = await getCatalogProduct(productId, kind)
  const wallet = await getBilling(organizationId)
  if (kind === "pack" && !hasPaidAccess(wallet))
    throw new Forbidden("An active paid plan is required to buy credits")
  if (kind === "plan" && hasPaidAccess(wallet))
    throw new BadRequest(
      "Change the current plan instead of starting another subscription",
    )
  if (
    kind === "pack" &&
    (!Number.isSafeInteger(units) ||
      units! < product.minimumUnits! ||
      units! > MAX_CREDITS)
  )
    throw new BadRequest("Credit quantity is outside the allowed range")
  const stripe = requireStripe()
  const customer = await ensureCustomer(organizationId, email)
  if (kind === "plan") {
    for await (const sub of stripe.subscriptions.list({
      customer,
      status: "all",
      limit: 100,
    }))
      if (!["canceled", "incomplete_expired"].includes(sub.status))
        throw new BadRequest(
          "This organization already has a Stripe subscription",
        )
  }
  const session = await stripe.checkout.sessions.create({
    mode: kind === "plan" ? "subscription" : "payment",
    customer,
    client_reference_id: organizationId,
    line_items: [
      { price: product.priceId, quantity: kind === "plan" ? 1 : units! },
    ],
    managed_payments: { enabled: true },
    billing_address_collection: "required",
    ...(kind === "plan"
      ? { subscription_data: { metadata: { organizationId } } }
      : { metadata: { organizationId, kind: "credit_top_up" } }),
    success_url: `${billingUrl()}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: billingUrl(),
  })
  if (!session.url) throw new Error("Stripe did not return a checkout URL")
  return { url: session.url }
}

export async function changePlan(organizationId: string, productId: string) {
  const next = await getCatalogProduct(productId, "plan")
  const wallet = await getBilling(organizationId)
  if (
    !hasPaidAccess(wallet) ||
    !wallet?.stripeSubscriptionId ||
    !wallet.productId
  )
    throw new BadRequest("No paid subscription to change")
  if (wallet.pendingProductId)
    throw new BadRequest("A plan change is already pending")
  const current = await getCatalogProduct(wallet.productId, "plan")
  if (next.planTier === current.planTier)
    throw new BadRequest("Choose a different plan tier")
  const stripe = requireStripe()
  const sub = await stripe.subscriptions.retrieve(wallet.stripeSubscriptionId)
  if (
    !sub.managed_payments?.enabled ||
    id(sub.customer) !== wallet.stripeCustomerId ||
    sub.items.data.length !== 1
  )
    throw new BadRequest("Subscription cannot be changed")
  const item = sub.items.data[0]!
  if (next.planTier! > current.planTier!) {
    await stripe.subscriptions.update(sub.id, {
      items: [{ id: item.id, price: next.priceId, quantity: 1 }],
      proration_behavior: "none",
      billing_cycle_anchor: { type: "now" },
    })
  } else {
    const schedule = sub.schedule
      ? await stripe.subscriptionSchedules.retrieve(id(sub.schedule)!)
      : await stripe.subscriptionSchedules.create({ from_subscription: sub.id })
    const phase = schedule.phases[0]
    if (!phase) throw new Error("Stripe subscription schedule has no phase")
    await stripe.subscriptionSchedules.update(schedule.id, {
      end_behavior: "release",
      phases: [
        {
          items: [{ price: item.price.id, quantity: 1 }],
          start_date: phase.start_date,
          end_date: item.current_period_end,
        },
        {
          items: [{ price: next.priceId, quantity: 1 }],
          start_date: item.current_period_end,
          proration_behavior: "none",
        },
      ],
    })
  }
  await db
    .update(organizationWallets)
    .set({ pendingProductId: next.id })
    .where(eq(organizationWallets.organizationId, organizationId))
  return { pending: true }
}

export async function cancel(organizationId: string, resume = false) {
  const wallet = await getBilling(organizationId)
  if (
    !hasPaidAccess(wallet) ||
    !wallet?.stripeSubscriptionId ||
    (resume && !wallet.cancelAtPeriodEnd)
  )
    throw new BadRequest(
      resume ? "No cancellation to resume" : "No paid subscription to cancel",
    )
  const stripe = requireStripe()
  const sub = await stripe.subscriptions.retrieve(wallet.stripeSubscriptionId)
  if (sub.schedule && !resume)
    await stripe.subscriptionSchedules.release(id(sub.schedule)!)
  const updated = await stripe.subscriptions.update(sub.id, {
    cancel_at_period_end: !resume,
  })
  await syncSubscription(updated)
  if (sub.schedule && !resume)
    await db
      .update(organizationWallets)
      .set({ pendingProductId: null })
      .where(eq(organizationWallets.organizationId, organizationId))
  return { pending: !resume }
}

export async function portal(organizationId: string) {
  const wallet = await getBilling(organizationId)
  if (!wallet?.stripeCustomerId) throw new BadRequest("No billing customer yet")
  if (!process.env.STRIPE_PORTAL_CONFIGURATION_ID)
    throw new Error("Restricted Stripe portal configuration is required")
  const session = await requireStripe().billingPortal.sessions.create({
    customer: wallet.stripeCustomerId,
    return_url: billingUrl(),
    configuration: process.env.STRIPE_PORTAL_CONFIGURATION_ID,
  })
  return { url: session.url }
}

export async function syncSubscription(sub: Stripe.Subscription) {
  const organizationId = sub.metadata.organizationId
  const wallet = organizationId ? await getBilling(organizationId) : null
  if (
    !wallet ||
    id(sub.customer) !== wallet.stripeCustomerId ||
    !sub.managed_payments?.enabled
  )
    throw new Error(`Unmapped Stripe subscription ${sub.id}`)
  const paidProductConfirmed = sub.items.data.some(
    (item) =>
      item.price.product === wallet.productId ||
      id(item.price.product) === wallet.productId,
  )
  await db
    .update(organizationWallets)
    .set({
      stripeSubscriptionId: sub.id,
      status: sub.status,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      pendingProductId: paidProductConfirmed
        ? wallet.pendingProductId
        : id(sub.items.data[0]?.price.product ?? null),
      updatedAt: new Date(),
    })
    .where(eq(organizationWallets.organizationId, organizationId))
  if (["canceled", "unpaid"].includes(sub.status) && !sub.cancel_at_period_end)
    await billingService.expireSubscriptionCredits(organizationId)
}

async function grantInvoice(invoice: Stripe.Invoice) {
  if (
    invoice.status !== "paid" ||
    ![
      "subscription_create",
      "subscription_cycle",
      "subscription_update",
    ].includes(invoice.billing_reason ?? "")
  )
    return
  const subscriptionId = id(
    invoice.parent?.subscription_details?.subscription ?? null,
  )
  if (!subscriptionId) return
  const stripe = requireStripe()
  const sub = await stripe.subscriptions.retrieve(subscriptionId)
  const organizationId = sub.metadata.organizationId
  const wallet = organizationId ? await getBilling(organizationId) : null
  if (
    !wallet ||
    id(sub.customer) !== wallet.stripeCustomerId ||
    id(invoice.customer) !== wallet.stripeCustomerId ||
    !sub.managed_payments?.enabled
  )
    throw new Error(`Unmapped Stripe invoice ${invoice.id}`)
  const item = sub.items.data[0]
  if (!item) return
  const product = await getCatalogProduct(id(item.price.product)!, "plan")
  const line = invoice.lines.data.find(
    (entry) => entry.pricing?.price_details?.price === item.price.id,
  )
  if (!line) return
  const periodStart = new Date(line.period.start * 1000)
  const periodEnd = new Date(line.period.end * 1000)
  if (
    periodEnd <= new Date() ||
    (wallet.periodStart && periodStart < wallet.periodStart)
  )
    return
  // An upgrade only grants the full allowance when Stripe actually reset the period.
  if (
    invoice.billing_reason === "subscription_update" &&
    wallet.periodStart &&
    periodStart <= wallet.periodStart
  )
    return
  await billingService.grantSubscriptionCredits({
    organizationId,
    amount: BigInt(product.credits!),
    periodEnd,
    idempotencyKey: `stripe:invoice:${invoice.id}`,
    metadata: { invoiceId: invoice.id, subscriptionId },
  })
  await db
    .update(organizationWallets)
    .set({
      stripeSubscriptionId: sub.id,
      productId: product.id,
      productName: product.name,
      allowance: BigInt(product.credits!),
      status: sub.status,
      periodStart,
      periodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      pendingProductId: null,
      updatedAt: new Date(),
    })
    .where(eq(organizationWallets.organizationId, organizationId))
}

async function grantCreditCheckout(session: Stripe.Checkout.Session) {
  if (
    session.mode !== "payment" ||
    session.payment_status !== "paid" ||
    session.metadata?.kind !== "credit_top_up"
  )
    return
  const organizationId = session.client_reference_id
  const wallet = organizationId ? await getBilling(organizationId) : null
  if (
    !wallet ||
    id(session.customer) !== wallet.stripeCustomerId ||
    session.metadata.organizationId !== organizationId
  )
    throw new Error(`Unmapped Stripe credit checkout ${session.id}`)
  const lines = await requireStripe().checkout.sessions.listLineItems(
    session.id,
    { limit: 2 },
  )
  const product = (await products()).find((entry) => entry.kind === "pack")!
  const units = lines.data[0]?.quantity
  if (
    lines.has_more ||
    lines.data.length !== 1 ||
    lines.data[0]?.price?.id !== product.priceId ||
    !Number.isSafeInteger(units) ||
    units! < product.minimumUnits! ||
    units! > MAX_CREDITS
  )
    throw new Error(`Invalid Stripe credit checkout ${session.id}`)
  await billingService.grantPaygCredits({
    organizationId: organizationId!,
    amount: BigInt(units!),
    purchasedAt: new Date(session.created * 1000),
    idempotencyKey: `stripe:checkout:${session.id}`,
    metadata: { sessionId: session.id, priceId: product.priceId },
  })
}

async function handleRefund(charge: Stripe.Charge) {
  if (charge.amount_refunded < charge.amount || !charge.payment_intent) return
  const paymentIntentId = id(charge.payment_intent)
  const customerId = id(charge.customer)
  if (!paymentIntentId || !customerId) return
  const stripe = requireStripe()
  const [wallet] = await db
    .select()
    .from(organizationWallets)
    .where(eq(organizationWallets.stripeCustomerId, customerId))
    .limit(1)
  if (!wallet) return
  const sessions = await stripe.checkout.sessions.list({
    payment_intent: paymentIntentId,
    limit: 1,
  })
  const session = sessions.data[0]
  if (
    session?.mode === "payment" &&
    session.metadata?.kind === "credit_top_up"
  ) {
    await billingService.revokePaygGrant({
      organizationId: wallet.organizationId,
      sourceKey: `stripe:checkout:${session.id}`,
      idempotencyKey: `stripe:checkout:${session.id}:refund`,
    })
    return
  }
  for await (const invoice of stripe.invoices.list({
    customer: customerId,
    status: "paid",
    limit: 100,
  })) {
    for await (const payment of stripe.invoicePayments.list({
      invoice: invoice.id,
      limit: 100,
    })) {
      if (id(payment.payment.payment_intent ?? null) !== paymentIntentId)
        continue
      const subscriptionId = id(
        invoice.parent?.subscription_details?.subscription ?? null,
      )
      if (!subscriptionId || subscriptionId !== wallet.stripeSubscriptionId)
        return
      const periodStart = invoice.lines.data[0]?.period.start
      if (
        !wallet.periodStart ||
        !periodStart ||
        wallet.periodStart.getTime() !== periodStart * 1000
      )
        return
      await billingService.revokeSubscriptionGrant({
        organizationId: wallet.organizationId,
        sourceKey: `stripe:invoice:${invoice.id}`,
        idempotencyKey: `stripe:invoice:${invoice.id}:refund`,
      })
      return
    }
  }
}

export const stripeWebhookRoutes = new Elysia({ prefix: "/billing" }).post(
  "/stripe/webhook",
  async ({ request }) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET
    if (!secret) throw new Error("Stripe webhook is not configured")
    const signature = request.headers.get("stripe-signature")
    if (!signature) throw new BadRequest("Missing Stripe signature")
    let event: Stripe.Event
    try {
      event = await requireStripe().webhooks.constructEventAsync(
        await request.text(),
        signature,
        secret,
      )
    } catch {
      throw new BadRequest("Invalid Stripe signature")
    }
    if (
      event.livemode !==
      /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY ?? "")
    )
      throw new BadRequest("Stripe mode mismatch")
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    )
      await grantCreditCheckout(event.data.object)
    if (event.type === "invoice.paid") await grantInvoice(event.data.object)
    if (event.type === "charge.refunded") await handleRefund(event.data.object)
    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    )
      await syncSubscription(event.data.object)
    return { received: true }
  },
)

export async function reconcileOrganization(organizationId: string) {
  const wallet = await getBilling(organizationId)
  if (!wallet?.stripeCustomerId) return
  const stripe = requireStripe()
  if (wallet.stripeSubscriptionId)
    await syncSubscription(
      await stripe.subscriptions.retrieve(wallet.stripeSubscriptionId),
    )
  for await (const invoice of stripe.invoices.list({
    customer: wallet.stripeCustomerId,
    status: "paid",
    limit: 100,
  }))
    await grantInvoice(invoice)
  for await (const session of stripe.checkout.sessions.list({
    customer: wallet.stripeCustomerId,
    limit: 100,
  }))
    await grantCreditCheckout(session)
  for await (const charge of stripe.charges.list({
    customer: wallet.stripeCustomerId,
    limit: 100,
  }))
    await handleRefund(charge)
}
