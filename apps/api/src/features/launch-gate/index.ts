import { Elysia, t } from "elysia"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { featureFlags, waitingList } from "@/db/schema"

export async function acceptingUsers(): Promise<boolean> {
  const [flag] = await db
    .select({ enable: featureFlags.enable })
    .from(featureFlags)
    .where(eq(featureFlags.name, "ACCEPT_USERS"))
    .limit(1)
  return flag?.enable ?? false
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const launchGateRoutes = new Elysia()
  .get("/feature-flags/ACCEPT_USERS", async () => ({
    enable: await acceptingUsers(),
  }))
  .post(
    "/waiting-list",
    async ({ body, set }) => {
      if (await acceptingUsers()) {
        set.status = 409
        return { error: "Sign-up is open now." }
      }

      const email = body.email.trim().toLowerCase()
      if (email.length > 320 || !emailPattern.test(email)) {
        set.status = 400
        return { error: "Enter a valid email address." }
      }

      await db.insert(waitingList).values({ email }).onConflictDoNothing()
      return { success: true }
    },
    { body: t.Object({ email: t.String({ minLength: 3, maxLength: 320 }) }) },
  )
