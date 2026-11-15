import { APIError } from "better-auth/api"
import { inArray, eq } from "drizzle-orm"
import { db } from "@/db"
import { member, organization, organizationWallets } from "@/db/schema"
import { requireStripe } from "@/features/billing/stripe-client"
import { expireAssetsForOrganizations } from "@/features/media-engine/asset-retention"

export type AccountDeletionStripe = {
  cancelSubscription: (subscriptionId: string) => Promise<void>
  deleteCustomer: (customerId: string) => Promise<void>
}

type Membership = {
  organizationId: string
  organizationName: string
  userId: string
  role: string
  createdAt: Date
}

function abort(message: string): never {
  throw APIError.from("BAD_REQUEST", {
    code: "ACCOUNT_DELETION_ABORTED",
    message,
  })
}

function stripeAccountClient(): AccountDeletionStripe {
  const stripe = requireStripe()
  return {
    async cancelSubscription(subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      if (!["canceled", "incomplete_expired"].includes(subscription.status))
        await stripe.subscriptions.cancel(subscriptionId)
    },
    async deleteCustomer(customerId) {
      await stripe.customers.del(customerId)
    },
  }
}

/** Cancel paid billing before deleting sole-member organizations. */
export async function prepareAccountDeletion(
  userId: string,
  options: { stripe?: AccountDeletionStripe | null } = {},
) {
  const ownMemberships = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, userId))
  if (ownMemberships.length === 0) return
  const memberships: Membership[] = await db
    .select({
      organizationId: member.organizationId,
      organizationName: organization.name,
      userId: member.userId,
      role: member.role,
      createdAt: member.createdAt,
    })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(
      inArray(
        member.organizationId,
        ownMemberships.map((row) => row.organizationId),
      ),
    )
  const groups = new Map<string, Membership[]>()
  for (const row of memberships)
    groups.set(row.organizationId, [
      ...(groups.get(row.organizationId) ?? []),
      row,
    ])
  const soleOrganizationIds: string[] = []
  const blocked: string[] = []
  for (const [organizationId, members] of groups) {
    const self = members.find((row) => row.userId === userId)
    if (!self) continue
    if (members.length === 1) {
      soleOrganizationIds.push(organizationId)
      continue
    }
    if (
      self.role === "owner" &&
      !members.some((row) => row.userId !== userId && row.role === "owner")
    )
      blocked.push(self.organizationName)
  }
  if (blocked.length)
    abort(
      `You are the only owner of ${blocked.join(", ")}. Transfer ownership or remove the other members before deleting your account.`,
    )
  if (!soleOrganizationIds.length) return
  const wallets = await db
    .select()
    .from(organizationWallets)
    .where(inArray(organizationWallets.organizationId, soleOrganizationIds))
  const requiresStripe = wallets.some(
    (row) => row.stripeCustomerId || row.stripeSubscriptionId,
  )
  const stripe =
    options.stripe === undefined && requiresStripe
      ? stripeAccountClient()
      : options.stripe
  if (requiresStripe && !stripe)
    abort(
      "The payment system is not configured, so billing could not be cancelled. Your account was not deleted.",
    )
  for (const wallet of wallets) {
    try {
      if (wallet.stripeSubscriptionId)
        await stripe!.cancelSubscription(wallet.stripeSubscriptionId)
      if (wallet.stripeCustomerId)
        await stripe!.deleteCustomer(wallet.stripeCustomerId)
    } catch (error) {
      console.error("[account] Failed to remove Stripe billing:", error)
      abort(
        "Could not remove billing in the payment system. Your account was not deleted.",
      )
    }
  }
  await expireAssetsForOrganizations(soleOrganizationIds)
  await db
    .delete(organization)
    .where(inArray(organization.id, soleOrganizationIds))
}
