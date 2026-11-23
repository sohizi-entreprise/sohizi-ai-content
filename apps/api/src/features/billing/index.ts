import { Elysia } from "elysia"
import { z } from "zod"
import { authMiddleware } from "@/lib/auth-middleware"
import { assertOrgMember, requireActiveOrganization } from "@/lib/authorize"
import { billingService } from "./service"
import { db } from "@/db"
import { member } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { Forbidden } from "@/features/error"
import {
  catalog,
  getBilling,
  hasPaidAccess,
  checkout,
  changePlan,
  cancel,
  portal,
  reconcileOrganization,
} from "./stripe"

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

export const publicTopUpPricingRoutes = new Elysia({ prefix: "/billing" }).get(
  "/top-up-pricing",
  async () => ({
    products: (await catalog()).flatMap((product) => {
      if (
        product.kind !== "pack" ||
        product.unitAmount == null ||
        product.currency == null
      )
        return []
      return [
        {
          id: product.id,
          name: product.name,
          unitAmount: product.unitAmount,
          minimumUnits: product.minimumUnits,
          maximumUnits: product.maximumUnits,
          currency: product.currency,
        },
      ]
    }),
  }),
)

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
      return checkout(
        organizationId,
        body.productId,
        body.kind,
        body.units,
        user.email,
      )
    },
    {
      body: z.object({
        productId: z.string(),
        kind: z.enum(["plan", "pack"]),
        units: z.number().int().positive().optional(),
      }),
    },
  )
  .post(
    "/change-plan",
    async ({ session, user, body }) => {
      const { organizationId } = await billingContext(user.id, session, true)
      return changePlan(organizationId, body.productId)
    },
    { body: z.object({ productId: z.string() }) },
  )
  .post("/cancel", async ({ session, user }) => {
    const { organizationId } = await billingContext(user.id, session, true)
    return cancel(organizationId)
  })
  .post("/resume", async ({ session, user }) => {
    const { organizationId } = await billingContext(user.id, session, true)
    return cancel(organizationId, true)
  })
  .post("/portal", async ({ session, user }) => {
    const { organizationId } = await billingContext(user.id, session, true)
    return portal(organizationId)
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
