import "dotenv/config"
import { randomUUID } from "node:crypto"
import { hashPassword, verifyPassword } from "better-auth/crypto"
import { and, eq, sql } from "drizzle-orm"

const EMAIL = "local-user@test.com"
const PASSWORD = "testing-agent-password"
const ORGANIZATION_SLUG = "test-organisation"
const CREDENTIAL_ISSUER = "local:credential"

function requireLocalUrl(name: string, value: string | undefined): URL {
  if (!value) throw new Error(`${name} is not configured`)
  const url = new URL(value)
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error(`${name} must point to this machine`)
  }
  if (name === "DATABASE_URL") {
    if (!["postgres:", "postgresql:", "psql:"].includes(url.protocol)) {
      throw new Error("DATABASE_URL must use PostgreSQL")
    }
  } else if (url.protocol !== "http:") {
    throw new Error(`${name} must use local HTTP`)
  }
  return url
}

requireLocalUrl("DATABASE_URL", process.env.DATABASE_URL)
requireLocalUrl("BETTER_AUTH_URL", process.env.BETTER_AUTH_URL)
requireLocalUrl("FRONTEND_URL", process.env.FRONTEND_URL)

// Import the database only after rejecting non-local connection settings.
const [{ db }, { account, member, organization, user }, { billingService }] =
  await Promise.all([
    import("@/db"),
    import("@/db/schema"),
    import("@/features/billing/service"),
  ])

const result = await db.transaction(async (tx) => {
  // Serialize concurrent invocations; the member table has no unique pair key.
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext('sohizi-local-app-testing'))`,
  )

  let [testUser] = await tx.select().from(user).where(eq(user.email, EMAIL))
  const createdUser = !testUser
  if (!testUser) {
    ;[testUser] = await tx
      .insert(user)
      .values({
        id: randomUUID(),
        name: "Local Test User",
        email: EMAIL,
        emailVerified: true,
      })
      .returning()
  } else if (!testUser.emailVerified) {
    ;[testUser] = await tx
      .update(user)
      .set({ emailVerified: true })
      .where(eq(user.id, testUser.id))
      .returning()
  }

  let [credential] = await tx
    .select()
    .from(account)
    .where(
      and(
        eq(account.userId, testUser.id),
        eq(account.providerId, "credential"),
        eq(account.issuer, CREDENTIAL_ISSUER),
      ),
    )
  let repairedPassword = false
  if (!credential) {
    ;[credential] = await tx
      .insert(account)
      .values({
        id: randomUUID(),
        accountId: testUser.id,
        userId: testUser.id,
        providerId: "credential",
        issuer: CREDENTIAL_ISSUER,
        password: await hashPassword(PASSWORD),
      })
      .returning()
    repairedPassword = !createdUser
  } else if (
    !credential.password ||
    !(await verifyPassword({ hash: credential.password, password: PASSWORD }))
  ) {
    await tx
      .update(account)
      .set({ password: await hashPassword(PASSWORD) })
      .where(eq(account.id, credential.id))
    repairedPassword = true
  }

  let [testOrganization] = await tx
    .select()
    .from(organization)
    .where(eq(organization.slug, ORGANIZATION_SLUG))
  const createdOrganization = !testOrganization
  if (!testOrganization) {
    ;[testOrganization] = await tx
      .insert(organization)
      .values({
        id: randomUUID(),
        name: "Test Organisation",
        slug: ORGANIZATION_SLUG,
      })
      .returning()
  }

  const [membership] = await tx
    .select()
    .from(member)
    .where(
      and(
        eq(member.userId, testUser.id),
        eq(member.organizationId, testOrganization.id),
      ),
    )
  if (!membership) {
    await tx.insert(member).values({
      id: randomUUID(),
      userId: testUser.id,
      organizationId: testOrganization.id,
      role: "owner",
    })
  } else if (membership.role !== "owner") {
    await tx
      .update(member)
      .set({ role: "owner" })
      .where(eq(member.id, membership.id))
  }

  return {
    organizationId: testOrganization.id,
    createdUser,
    createdOrganization,
    repairedPassword,
    createdMembership: !membership,
  }
})

// The regular organization hook uses this same key. topup is idempotent, so a
// retry also repairs a previous run that stopped after the account transaction.
await billingService.topup({
  organizationId: result.organizationId,
  amount: 500n,
  idempotencyKey: `org-welcome:${result.organizationId}`,
  metadata: { reason: "welcome_credits" },
})

console.log(
  JSON.stringify({
    email: EMAIL,
    organizationSlug: ORGANIZATION_SLUG,
    ...result,
    welcomeCreditsEnsured: true,
  }),
)
