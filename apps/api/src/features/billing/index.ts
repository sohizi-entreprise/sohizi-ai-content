import { Elysia } from "elysia"
import { z } from "zod"
import { authMiddleware } from "@/lib/auth-middleware"
import { assertOrgMember, requireActiveOrganization } from "@/lib/authorize"
import { billingService } from "./service"
import { db } from "@/db"
import { member } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { BadRequest, Forbidden } from "@/features/error"
import {
  catalog,
  ensurePolarCustomer,
  getBilling,
  getCatalogProduct,
  hasPaidAccess,
  planChangeBehavior,
  planTier,
  reconcileOrganization,
  syncSubscription,
} from "./polar"
import { requirePolar } from "./polar-client"

export async function billingContext(
  userId: string,
  session: { activeOrganizationId?: string | null },
  manager = false,
) {
  const organizationId = requireActiveOrganization(session)
  const [membership] = await db
    .select({ role: member.role })
    .from(member)
    .where(
      and(eq(member.organizationId, organizationId), eq(member.userId, userId)),
    )
    .limit(1)
  if (!membership) throw new Forbidden("Not a member of this organization")
  if (
    manager &&
    !membership.role
      .split(",")
      .some((role) => ["owner", "admin"].includes(role.trim()))
  )
    throw new Forbidden("Organization billing manager access required")
  return {
    organizationId,
    canManage: membership.role
      .split(",")
      .some((role) => ["owner", "admin"].includes(role.trim())),
  }
}

function publicBillingUrl() {
  const origin = process.env.FRONTEND_URL
  if (!origin) throw new Error("FRONTEND_URL is required for billing")
  return new URL("/account/billing", origin).toString()
}

export const billingRoutes = new Elysia({ prefix: "/billing" })
  .use(authMiddleware)
  .get("/catalog", async () => ({ products: await catalog() }))
  .get("/summary", async ({ session, user }) => {
    const { organizationId, canManage } = await billingContext(user.id, session)
    const [billing, balances] = await Promise.all([
      getBilling(organizationId),
      billingService.getBalances(organizationId),
    ])
    return {
      organizationId,
      canManage,
      plan: hasPaidAccess(billing)
        ? {
            id: billing!.productId,
            name: billing!.productName,
            status: billing!.status,
            allowance: billing!.allowance?.toString() ?? null,
            periodEnd: billing!.periodEnd?.toISOString() ?? null,
            cancelAtPeriodEnd: billing!.cancelAtPeriodEnd,
            pendingProductId: billing!.pendingProductId,
          }
        : null,
      balance: balances.balance.toString(),
      includedBalance: balances.subscriptionBalance.toString(),
      purchasedBalance: balances.paygBalance.toString(),
      includedExpiresAt: balances.balanceExpiresAt?.toISOString() ?? null,
      purchasedExpiresAt: balances.paygBalanceExpiresAt?.toISOString() ?? null,
    }
  })
  .post(
    "/checkout",
    async ({ session, user, body }) => {
      const { organizationId } = await billingContext(user.id, session, true)
      await getCatalogProduct(body.productId, body.kind)
      const billing = await getBilling(organizationId)
      if (body.kind === "pack" && !hasPaidAccess(billing))
        throw new Forbidden("An active paid plan is required to buy credits")
      if (body.kind === "plan" && hasPaidAccess(billing))
        throw new BadRequest(
          "Change the current plan instead of starting another subscription",
        )
      const customerId = await ensurePolarCustomer(organizationId)
      const checkout = await requirePolar().checkouts.create({
        customer_id: customerId,
        products: [body.productId],
        allow_trial: false,
        metadata: { organizationId },
        success_url: publicBillingUrl() + "?checkout=success",
        return_url: publicBillingUrl(),
      })
      return { url: checkout.url }
    },
    {
      body: z.object({ productId: z.string(), kind: z.enum(["plan", "pack"]) }),
    },
  )
  .post(
    "/change-plan",
    async ({ session, user, body }) => {
      const { organizationId } = await billingContext(user.id, session, true)
      const product = await getCatalogProduct(body.productId, "plan")
      const billing = await getBilling(organizationId)
      if (
        !hasPaidAccess(billing) ||
        !billing?.polarSubscriptionId ||
        !billing.productId
      )
        throw new BadRequest("No paid subscription to change")
      if (billing.pendingProductId)
        throw new BadRequest("A plan change is already pending")
      if (body.productId === billing.productId)
        throw new BadRequest("Choose a different plan")
      const currentProduct = await requirePolar().products.get(
        billing.productId,
      )
      const currentTier = planTier(currentProduct.metadata)
      const nextTier = planTier(product.metadata)
      if (!currentTier || !nextTier)
        throw new BadRequest("Plan tier metadata is missing")
      const behavior = planChangeBehavior(currentTier, nextTier)
      if (!behavior) throw new BadRequest("Choose a different plan tier")
      if (behavior === "reset") {
        const polarOrganization = await requirePolar().organizations.get(
          product.organization_id,
        )
        if (
          !polarOrganization.feature_settings?.reset_proration_behavior_enabled
        )
          throw new BadRequest(
            "Immediate plan upgrades are not enabled in Polar yet",
          )
      }
      const subscription = await requirePolar().subscriptions.update(
        billing.polarSubscriptionId,
        {
          product_id: body.productId,
          proration_behavior: behavior,
        },
      )
      await syncSubscription(subscription)
      return { pending: true }
    },
    { body: z.object({ productId: z.string() }) },
  )
  .post("/cancel", async ({ session, user }) => {
    const { organizationId } = await billingContext(user.id, session, true)
    const billing = await getBilling(organizationId)
    if (!hasPaidAccess(billing) || !billing?.polarSubscriptionId)
      throw new BadRequest("No paid subscription to cancel")
    await syncSubscription(
      await requirePolar().subscriptions.update(billing.polarSubscriptionId, {
        cancel_at_period_end: true,
      }),
    )
    return { pending: true }
  })
  .post("/resume", async ({ session, user }) => {
    const { organizationId } = await billingContext(user.id, session, true)
    const billing = await getBilling(organizationId)
    if (
      !billing?.polarSubscriptionId ||
      !billing.cancelAtPeriodEnd ||
      !hasPaidAccess(billing)
    )
      throw new BadRequest("No cancellation to resume")
    await syncSubscription(
      await requirePolar().subscriptions.update(billing.polarSubscriptionId, {
        cancel_at_period_end: false,
      }),
    )
    return { pending: false }
  })
  .post("/portal", async ({ session, user }) => {
    const { organizationId } = await billingContext(user.id, session, true)
    const billing = await getBilling(organizationId)
    if (!billing?.polarCustomerId)
      throw new BadRequest("No billing customer yet")
    const portal = await requirePolar().customerSessions.create({
      customer_id: billing.polarCustomerId,
      return_url: publicBillingUrl(),
    })
    return { url: portal.customer_portal_url }
  })
  .post("/reconcile", async ({ session, user }) => {
    const { organizationId } = await billingContext(user.id, session, true)
    await reconcileOrganization(organizationId)
    return { ok: true }
  })
  .get(
    "/balance",
    async ({ session, user, query }) => {
      const organizationId = requireActiveOrganization(
        session,
        query.organizationId,
      )
      await assertOrgMember(user.id, organizationId)
      const balances = await billingService.getBalances(organizationId)
      return {
        organizationId,
        balance: balances.balance.toString(),
        subscriptionBalance: balances.subscriptionBalance.toString(),
        paygBalance: balances.paygBalance.toString(),
        balanceExpiresAt: balances.balanceExpiresAt?.toISOString() ?? null,
        paygBalanceExpiresAt:
          balances.paygBalanceExpiresAt?.toISOString() ?? null,
        currency: "credits" as const,
      }
    },
    {
      query: z.object({
        organizationId: z.string().optional(),
      }),
    },
  )

export { billingService, BillingService } from "./service"
export * from "./types"
export * from "./errors"
export * from "./constants"
export * from "./credits"
export {
  withBilling,
  withBillingAsync,
  withBillingStream,
  safeRefund,
} from "./wrapper"
export type { AsyncReservationHandle, WithBillingCallContext } from "./wrapper"
