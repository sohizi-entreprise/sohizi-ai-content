import { Elysia, t } from "elysia"
import { randomUUID } from "node:crypto"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { analyticsConsents } from "@/db/schema"
import { captureServerEvent } from "@sohizi/analytics/server"
import {
  buildConsentCookie,
  CONSENT_COOKIE,
  isConsentCurrent,
  POLICY_VERSION,
  SIX_MONTHS_SECONDS,
} from "@sohizi/analytics/policy"
import type {
  AnalyticsEventName,
  AnalyticsProperties,
} from "@sohizi/analytics/events"

type Choice = "accepted" | "rejected"

function cookieId(request: Request): string | null {
  const match = request.headers
    .get("cookie")
    ?.split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${CONSENT_COOKIE}=`))
  const value = match?.slice(CONSENT_COOKIE.length + 1)
  return value && /^[0-9a-f-]{36}$/i.test(value) ? value : null
}

async function currentRecord(request: Request) {
  const id = cookieId(request)
  if (!id) return null
  const [record] = await db
    .select()
    .from(analyticsConsents)
    .where(eq(analyticsConsents.id, id))
    .limit(1)
  if (!record || !isConsentCurrent(record)) return null
  return record
}

function allowedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin")
  if (!origin) return false
  const frontend = process.env.FRONTEND_URL
  return [
    "http://localhost:3000",
    "http://localhost:3001",
    frontend,
    frontend?.replace("//app.", "//www."),
  ].includes(origin)
}

export async function acceptedConsentId(
  request: Request,
  userId: string,
): Promise<string | null> {
  try {
    const record = await currentRecord(request)
    if (!record || record.choice !== "accepted") return null
    if (record.userId !== userId) {
      await db
        .update(analyticsConsents)
        .set({ userId })
        .where(eq(analyticsConsents.id, record.id))
    }
    return record.id
  } catch {
    return null
  }
}

export async function captureConsentedEvent<Name extends AnalyticsEventName>(
  consentId: string | null | undefined,
  userId: string,
  name: Name,
  properties: AnalyticsProperties<Name>,
): Promise<void> {
  if (!consentId) return
  try {
    const [record] = await db
      .select()
      .from(analyticsConsents)
      .where(eq(analyticsConsents.id, consentId))
      .limit(1)
    if (
      !record ||
      record.choice !== "accepted" ||
      record.userId !== userId ||
      !isConsentCurrent(record)
    )
      return
    captureServerEvent(userId, name, properties)
  } catch {
    // Analytics must never interrupt the product operation.
  }
}

export const analyticsConsentRoutes = new Elysia({
  prefix: "/analytics/consent",
})
  .get("/", async ({ request }) => {
    const record = await currentRecord(request)
    if (record?.choice === "accepted") {
      const { auth } = await import("@/lib/auth")
      const session = await auth.api
        .getSession({ headers: request.headers })
        .catch(() => null)
      if (session?.user.id && record.userId !== session.user.id) {
        await db
          .update(analyticsConsents)
          .set({ userId: session.user.id })
          .where(eq(analyticsConsents.id, record.id))
      }
    }
    return { choice: record?.choice ?? null }
  })
  .post(
    "/",
    async ({ request, body, set }) => {
      if (!allowedOrigin(request)) {
        set.status = 403
        return { error: "Invalid origin" }
      }
      const current = await currentRecord(request)
      const id = current?.id ?? randomUUID()
      const { auth } = await import("@/lib/auth")
      const session = await auth.api
        .getSession({ headers: request.headers })
        .catch(() => null)
      const record = {
        id,
        choice: body.choice as Choice,
        policyVersion: POLICY_VERSION,
        userId: session?.user.id ?? current?.userId ?? null,
        chosenAt: new Date(),
        expiresAt: new Date(Date.now() + SIX_MONTHS_SECONDS * 1000),
      }
      await db
        .insert(analyticsConsents)
        .values(record)
        .onConflictDoUpdate({
          target: analyticsConsents.id,
          set: {
            choice: record.choice,
            policyVersion: record.policyVersion,
            userId: record.userId,
            chosenAt: record.chosenAt,
            expiresAt: record.expiresAt,
          },
        })
      set.headers["Set-Cookie"] = buildConsentCookie(
        id,
        new URL(request.url).hostname,
      )
      return { choice: record.choice }
    },
    {
      body: t.Object({
        choice: t.Union([t.Literal("accepted"), t.Literal("rejected")]),
      }),
    },
  )
