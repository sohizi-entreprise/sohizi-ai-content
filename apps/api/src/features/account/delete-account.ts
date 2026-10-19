import { APIError } from "better-auth/api"
import { inArray, eq } from "drizzle-orm"
import { db } from "@/db"
import {
  assets,
  member,
  organization,
  organizationWallets,
  projects,
  user,
} from "@/db/schema"
import { polar } from "@/features/billing/polar-client"
import { deleteFile } from "@/features/media-engine/storage"

const RENEWABLE_STATUSES = new Set([
  "incomplete",
  "trialing",
  "active",
  "past_due",
  "unpaid",
])

export type AccountDeletionPolar = {
  cancelSubscription: (
    subscriptionId: string,
  ) => Promise<{ cancel_at_period_end: boolean }>
  deleteCustomer: (customerId: string) => Promise<void>
  transferOwnership: (input: {
    polarCustomerId: string
    fromUserId: string
    toUser: { id: string; email: string; name: string }
  }) => Promise<void>
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

export function polarAccountClient(): AccountDeletionPolar | null {
  const client = polar
  if (!client) return null
  return {
    async cancelSubscription(subscriptionId) {
      const subscription = await client.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      })
      return { cancel_at_period_end: subscription.cancel_at_period_end }
    },
    deleteCustomer: (customerId) => client.customers.delete(customerId),
    async transferOwnership({ polarCustomerId, fromUserId, toUser }) {
      const listed = await client.customers.members.list(polarCustomerId, {
        limit: 100,
      })
      const current = listed.items.find(
        (item) => item.external_id === fromUserId,
      )
      if (!current || current.role !== "owner") return
      const successor =
        listed.items.find((item) => item.external_id === toUser.id) ??
        (await client.customers.members.create(polarCustomerId, {
          email: toUser.email,
          name: toUser.name,
          external_id: toUser.id,
        }))
      const updated = await client.customers.members.update(
        polarCustomerId,
        successor.id,
        { role: "owner" },
      )
      if (updated.role !== "owner") {
        throw new Error("Polar did not transfer customer ownership")
      }
    },
  }
}

function subscriptionCanRenew(row: {
  polarSubscriptionId: string | null
  status: string
  cancelAtPeriodEnd: boolean
}) {
  return (
    !!row.polarSubscriptionId &&
    !row.cancelAtPeriodEnd &&
    RENEWABLE_STATUSES.has(row.status)
  )
}

/**
 * Cancels Polar billing before any local row is removed. A failed Polar call
 * throws and leaves the user, organizations, and wallets in place.
 */
export async function prepareAccountDeletion(
  userId: string,
  options: {
    polar?: AccountDeletionPolar | null
    deleteStorage?: (storageKey: string) => Promise<void>
  } = {},
) {
  const billing =
    options.polar === undefined ? polarAccountClient() : options.polar
  const deleteStorage = options.deleteStorage ?? deleteFile

  const ownMemberships = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, userId))
  if (ownMemberships.length === 0) return

  const organizationIds = ownMemberships.map((row) => row.organizationId)
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
    .where(inArray(member.organizationId, organizationIds))

  const byOrganization = new Map<string, Membership[]>()
  for (const row of memberships) {
    const group = byOrganization.get(row.organizationId) ?? []
    group.push(row)
    byOrganization.set(row.organizationId, group)
  }

  const blocked: string[] = []
  const soleOrganizationIds: string[] = []
  const shared: Array<{ organizationId: string; members: Membership[] }> = []
  for (const [organizationId, members] of byOrganization) {
    const self = members.find((row) => row.userId === userId)
    if (!self) continue
    if (members.length === 1) {
      soleOrganizationIds.push(organizationId)
      continue
    }
    const otherOwners = members.filter(
      (row) => row.userId !== userId && row.role === "owner",
    )
    if (self.role === "owner" && otherOwners.length === 0) {
      blocked.push(self.organizationName)
      continue
    }
    shared.push({ organizationId, members })
  }

  if (blocked.length > 0) {
    abort(
      `You are the only owner of ${blocked.join(", ")}. Transfer ownership or remove the other members before deleting your account.`,
    )
  }

  const wallets =
    soleOrganizationIds.length === 0
      ? []
      : await db
          .select()
          .from(organizationWallets)
          .where(
            inArray(organizationWallets.organizationId, soleOrganizationIds),
          )

  const toCancel = wallets.filter(subscriptionCanRenew)
  if (toCancel.length > 0 && !billing) {
    abort(
      "The payment system is not configured, so the subscription could not be cancelled. Your account was not deleted.",
    )
  }
  for (const wallet of toCancel) {
    try {
      const subscription = await billing!.cancelSubscription(
        wallet.polarSubscriptionId!,
      )
      if (!subscription.cancel_at_period_end) {
        abort(
          "The payment system did not confirm the subscription was cancelled. Your account was not deleted.",
        )
      }
    } catch (error) {
      if (error instanceof APIError) throw error
      console.error(
        `[account] Failed to cancel Polar subscription ${wallet.polarSubscriptionId}:`,
        error,
      )
      abort(
        "Could not cancel the subscription in the payment system. Your account was not deleted.",
      )
    }
  }

  const sharedWallets =
    shared.length === 0
      ? []
      : await db
          .select()
          .from(organizationWallets)
          .where(
            inArray(
              organizationWallets.organizationId,
              shared.map((row) => row.organizationId),
            ),
          )
  for (const workspace of shared) {
    const wallet = sharedWallets.find(
      (row) => row.organizationId === workspace.organizationId,
    )
    if (!wallet?.polarCustomerId) continue
    const successor = workspace.members
      .filter((row) => row.userId !== userId && row.role === "owner")
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0]
    if (!successor) continue
    const [successorUser] = await db
      .select({ id: user.id, email: user.email, name: user.name })
      .from(user)
      .where(eq(user.id, successor.userId))
      .limit(1)
    if (!successorUser) {
      abort(
        "Could not transfer billing ownership. Your account was not deleted.",
      )
    }
    if (!billing) {
      abort(
        "The payment system is not configured, so billing ownership could not be transferred. Your account was not deleted.",
      )
    }
    try {
      await billing.transferOwnership({
        polarCustomerId: wallet.polarCustomerId,
        fromUserId: userId,
        toUser: successorUser,
      })
    } catch (error) {
      if (error instanceof APIError) throw error
      console.error(
        `[account] Failed to transfer Polar customer ${wallet.polarCustomerId}:`,
        error,
      )
      abort(
        "Could not transfer billing ownership. Your account was not deleted.",
      )
    }
  }

  const customers = wallets.filter((row) => row.polarCustomerId)
  if (customers.length > 0 && !billing) {
    abort(
      "The payment system is not configured, so the billing customer could not be removed. Your account was not deleted.",
    )
  }
  for (const wallet of customers) {
    try {
      await billing!.deleteCustomer(wallet.polarCustomerId!)
    } catch (error) {
      if (error instanceof APIError) throw error
      console.error(
        `[account] Failed to delete Polar customer ${wallet.polarCustomerId}:`,
        error,
      )
      abort(
        "Could not remove the customer from the payment system. Your account was not deleted.",
      )
    }
  }

  if (soleOrganizationIds.length === 0) return

  const stored = await db
    .select({ storageKey: assets.storageKey })
    .from(assets)
    .innerJoin(projects, eq(assets.projectId, projects.id))
    .where(inArray(projects.organizationId, soleOrganizationIds))

  await db
    .delete(organization)
    .where(inArray(organization.id, soleOrganizationIds))

  for (const file of stored) {
    try {
      await deleteStorage(file.storageKey)
    } catch (error) {
      console.error(
        `[account] Failed to delete storage object ${file.storageKey}:`,
        error,
      )
    }
  }
}
