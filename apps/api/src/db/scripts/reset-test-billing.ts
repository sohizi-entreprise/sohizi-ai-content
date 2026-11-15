/** One-time prelaunch reset. Run separately in sandbox and production with RESET_TEST_BILLING=yes. */
import { eq } from "drizzle-orm"
import Stripe from "stripe"
import { db } from "@/db"
import { organizationWallets, billingReservations } from "@/db/schema"
import { billingService } from "@/features/billing/service"

if (process.env.RESET_TEST_BILLING !== "yes")
  throw new Error("Set RESET_TEST_BILLING=yes to run the prelaunch reset")
if (process.env.LEGACY_SUBSCRIPTIONS_CLEARED !== "yes")
  throw new Error(
    "Cancel legacy subscriptions in the former provider dashboard, then set LEGACY_SUBSCRIPTIONS_CLEARED=yes",
  )
const wallets = await db.select().from(organizationWallets)
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null
for (const wallet of wallets) {
  if (wallet.stripeSubscriptionId) {
    if (!stripe)
      throw new Error("Stripe is required to cancel existing subscriptions")
    const sub = await stripe.subscriptions.retrieve(wallet.stripeSubscriptionId)
    if (!["canceled", "incomplete_expired"].includes(sub.status))
      await stripe.subscriptions.cancel(sub.id)
  }
  await db
    .update(billingReservations)
    .set({ expiresAt: new Date(0) })
    .where(eq(billingReservations.organizationId, wallet.organizationId))
  while (await billingService.sweepExpired(1000)) {
    // Continue until no expired reservations remain.
  }
  await db
    .update(organizationWallets)
    .set({ balanceExpiresAt: new Date(0), paygBalanceExpiresAt: new Date(0) })
    .where(eq(organizationWallets.organizationId, wallet.organizationId))
  while (await billingService.sweepExpiredWallets(1000)) {
    // Continue until all test wallets are cleared.
  }
  await db
    .update(organizationWallets)
    .set({
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      productId: null,
      productName: null,
      allowance: null,
      status: "free",
      periodStart: null,
      periodEnd: null,
      cancelAtPeriodEnd: false,
      pendingProductId: null,
    })
    .where(eq(organizationWallets.organizationId, wallet.organizationId))
  console.log(`Reset billing for ${wallet.organizationId}`)
}
