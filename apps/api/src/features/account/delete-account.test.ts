import { describe, expect, test, afterAll } from "bun:test"
import { randomUUID } from "node:crypto"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import {
  assets,
  member,
  organization,
  organizationWallets,
  projects,
  user,
} from "@/db/schema"
import {
  prepareAccountDeletion,
  type AccountDeletionPolar,
} from "./delete-account"

const createdUsers: string[] = []
const createdOrgs: string[] = []

afterAll(async () => {
  for (const id of createdUsers) {
    await db.delete(user).where(eq(user.id, id))
  }
  for (const id of createdOrgs) {
    await db.delete(organization).where(eq(organization.id, id))
  }
})

async function createUser(name: string) {
  const id = randomUUID()
  await db.insert(user).values({
    id,
    name,
    email: `${id}@example.com`,
  })
  createdUsers.push(id)
  return id
}

async function createOrg(name: string) {
  const id = `org_${randomUUID().slice(0, 8)}`
  await db.insert(organization).values({ id, name, slug: id })
  createdOrgs.push(id)
  return id
}

async function addMember(
  organizationId: string,
  userId: string,
  role: string,
  createdAt = new Date(),
) {
  await db.insert(member).values({
    id: randomUUID(),
    organizationId,
    userId,
    role,
    createdAt,
  })
}

function polar(
  overrides: Partial<AccountDeletionPolar> = {},
): AccountDeletionPolar {
  return {
    cancelSubscription: async () => ({ cancel_at_period_end: true }),
    deleteCustomer: async () => {},
    transferOwnership: async () => {},
    ...overrides,
  }
}

describe("prepareAccountDeletion", () => {
  test("deletes a sole-member organization only after Polar cancel succeeds", async () => {
    const userId = await createUser("solo")
    const orgId = await createOrg("Solo workspace")
    await addMember(orgId, userId, "owner")
    const subscriptionId = `sub_${randomUUID()}`
    const customerId = `cus_${randomUUID()}`
    await db.insert(organizationWallets).values({
      organizationId: orgId,
      polarSubscriptionId: subscriptionId,
      polarCustomerId: customerId,
      status: "active",
      cancelAtPeriodEnd: false,
    })
    const [project] = await db
      .insert(projects)
      .values({ organizationId: orgId, title: "Draft" })
      .returning()
    await db.insert(assets).values({
      projectId: project.id,
      name: "shot",
      type: "image",
      url: "https://example.com/shot.png",
      storageKey: `assets/${project.id}`,
      source: "user-uploaded",
    })

    const calls: string[] = []
    await prepareAccountDeletion(userId, {
      polar: polar({
        cancelSubscription: async (id) => {
          const [stillThere] = await db
            .select({ id: organization.id })
            .from(organization)
            .where(eq(organization.id, orgId))
          expect(stillThere?.id).toBe(orgId)
          expect(id).toBe(subscriptionId)
          calls.push("cancel")
          return { cancel_at_period_end: true }
        },
        deleteCustomer: async (id) => {
          const [stillThere] = await db
            .select({ id: organization.id })
            .from(organization)
            .where(eq(organization.id, orgId))
          expect(stillThere?.id).toBe(orgId)
          expect(id).toBe(customerId)
          calls.push("delete-customer")
        },
      }),
    })

    expect(calls).toEqual(["cancel", "delete-customer"])
    const [expired] = await db
      .select({
        id: assets.id,
        projectId: assets.projectId,
        expireAt: assets.expireAt,
        storageKey: assets.storageKey,
      })
      .from(assets)
      .where(eq(assets.storageKey, `assets/${project.id}`))
    expect(expired?.storageKey).toBe(`assets/${project.id}`)
    expect(expired?.projectId).toBeNull()
    const remainingMs = (expired?.expireAt?.getTime() ?? 0) - Date.now()
    expect(remainingMs).toBeGreaterThan(23 * 60 * 60 * 1000)
    expect(remainingMs).toBeLessThan(25 * 60 * 60 * 1000)
    if (expired) {
      await db.delete(assets).where(eq(assets.id, expired.id))
    }
    const [org] = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.id, orgId))
    expect(org).toBeUndefined()
    const [remainingUser] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, userId))
    expect(remainingUser?.id).toBe(userId)
  })

  test("refuses when the user is the only owner of a shared workspace", async () => {
    const ownerId = await createUser("owner")
    const memberId = await createUser("member")
    const orgId = await createOrg("Shared")
    await addMember(orgId, ownerId, "owner")
    await addMember(orgId, memberId, "member")

    await expect(
      prepareAccountDeletion(ownerId, { polar: null }),
    ).rejects.toThrow(/only owner of Shared/)

    const [org] = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.id, orgId))
    expect(org?.id).toBe(orgId)
    const [owner] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, ownerId))
    expect(owner?.id).toBe(ownerId)
  })

  test("allows deletion when another owner remains", async () => {
    const ownerId = await createUser("owner")
    const otherOwnerId = await createUser("other")
    const orgId = await createOrg("Co-owned")
    await addMember(orgId, ownerId, "owner", new Date("2026-01-01"))
    await addMember(orgId, otherOwnerId, "owner", new Date("2026-01-02"))

    await prepareAccountDeletion(ownerId, { polar: null })

    const memberships = await db
      .select({ userId: member.userId })
      .from(member)
      .where(eq(member.organizationId, orgId))
    expect(memberships.map((row) => row.userId).sort()).toEqual(
      [ownerId, otherOwnerId].sort(),
    )
  })

  test("aborts without local deletes when Polar cancellation fails", async () => {
    const userId = await createUser("payer")
    const orgId = await createOrg("Paid")
    await addMember(orgId, userId, "owner")
    await db.insert(organizationWallets).values({
      organizationId: orgId,
      polarSubscriptionId: `sub_${randomUUID()}`,
      polarCustomerId: `cus_${randomUUID()}`,
      status: "active",
      cancelAtPeriodEnd: false,
    })
    let deletedCustomer = false

    await expect(
      prepareAccountDeletion(userId, {
        polar: polar({
          cancelSubscription: async () => {
            throw new Error("polar down")
          },
          deleteCustomer: async () => {
            deletedCustomer = true
          },
        }),
      }),
    ).rejects.toThrow(
      /could not cancel the subscription in the payment system/i,
    )

    expect(deletedCustomer).toBe(false)
    const [org] = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.id, orgId))
    const [wallet] = await db
      .select({ organizationId: organizationWallets.organizationId })
      .from(organizationWallets)
      .where(eq(organizationWallets.organizationId, orgId))
    const [remainingUser] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, userId))
    expect(org?.id).toBe(orgId)
    expect(wallet?.organizationId).toBe(orgId)
    expect(remainingUser?.id).toBe(userId)
  })

  test("aborts when Polar does not confirm cancellation", async () => {
    const userId = await createUser("unconfirmed")
    const orgId = await createOrg("Unconfirmed")
    await addMember(orgId, userId, "owner")
    await db.insert(organizationWallets).values({
      organizationId: orgId,
      polarSubscriptionId: `sub_${randomUUID()}`,
      status: "past_due",
      cancelAtPeriodEnd: false,
    })

    await expect(
      prepareAccountDeletion(userId, {
        polar: polar({
          cancelSubscription: async () => ({ cancel_at_period_end: false }),
        }),
      }),
    ).rejects.toThrow(/did not confirm/)

    const [wallet] = await db
      .select()
      .from(organizationWallets)
      .where(eq(organizationWallets.organizationId, orgId))
    expect(wallet?.organizationId).toBe(orgId)
  })
})
