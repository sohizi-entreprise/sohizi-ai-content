import { inngest } from "@/lib/inngest/client"
import { billingService } from "./service"
import { captureUnexpectedError } from "@/sentry"
import { db } from "@/db"
import { organizationWallets } from "@/db/schema"
import { reconcileOrganization } from "./polar"

const BATCH_SIZE = 100
const MAX_BATCHES_PER_RUN = 10

export async function runSweepBatches(input: {
  name: string
  sweep: (limit: number) => Promise<number>
  run: (id: string, fn: () => Promise<number>) => Promise<number>
  batchSize?: number
  maxBatches?: number
}): Promise<{ processed: number; backlogPossible: boolean }> {
  const batchSize = input.batchSize ?? BATCH_SIZE
  const maxBatches = input.maxBatches ?? MAX_BATCHES_PER_RUN
  let processed = 0
  let backlogPossible = false
  for (let batch = 0; batch < maxBatches; batch++) {
    const count = await input.run(`${input.name}-${batch}`, () =>
      input.sweep(batchSize),
    )
    processed += count
    backlogPossible = count === batchSize
    if (!backlogPossible) break
  }
  return { processed, backlogPossible }
}

/** Abandoned reservations are safely transitioned once, even on retries. */
export const sweepBillingReservations = inngest.createFunction(
  {
    id: "billing-reservation-expiration-sweep",
    triggers: [{ cron: "* * * * *" }],
    concurrency: { limit: 1 },
    retries: 3,
    onFailure: async ({ event }) => {
      captureUnexpectedError(event.data.error, {
        job: "billing-reservation-expiration-sweep",
      })
    },
  },
  async ({ step }) => {
    const run = (id: string, fn: () => Promise<number>) => step.run(id, fn)
    const reservations = await runSweepBatches({
      name: "reservations",
      sweep: (limit) => billingService.sweepExpired(limit),
      run,
    })
    if (reservations.backlogPossible) {
      console.warn(
        "[billing] reservation expiration sweep reached its batch limit",
      )
    }
    return {
      reservationsExpired: reservations.processed,
      backlogPossible: reservations.backlogPossible,
    }
  },
)

/** Idle wallet cleanup; spending paths also enforce expiry synchronously. */
export const sweepBillingWallets = inngest.createFunction(
  {
    id: "billing-wallet-expiration-sweep",
    triggers: [{ cron: "* * * * *" }],
    concurrency: { limit: 1 },
    retries: 3,
    onFailure: async ({ event }) => {
      captureUnexpectedError(event.data.error, {
        job: "billing-wallet-expiration-sweep",
      })
    },
  },
  async ({ step }) => {
    const run = (id: string, fn: () => Promise<number>) => step.run(id, fn)
    const wallets = await runSweepBatches({
      name: "wallets",
      sweep: (limit) => billingService.sweepExpiredWallets(limit),
      run,
    })
    if (wallets.backlogPossible) {
      console.warn("[billing] wallet expiration sweep reached its batch limit")
    }
    return {
      walletsExpired: wallets.processed,
      backlogPossible: wallets.backlogPossible,
    }
  },
)

/** Repair missing or out-of-order Polar webhooks from Polar's authoritative state. */
export const reconcilePolarBilling = inngest.createFunction(
  {
    id: "polar-billing-reconciliation",
    triggers: [{ cron: "0 3 * * *" }],
    concurrency: { limit: 1 },
    retries: 3,
  },
  async ({ step }) => {
    if (!process.env.POLAR_ACCESS_TOKEN) return { checked: 0 }
    const rows = await db
      .select({ organizationId: organizationWallets.organizationId })
      .from(organizationWallets)
    for (const row of rows) {
      await step.run(`reconcile-${row.organizationId}`, () =>
        reconcileOrganization(row.organizationId),
      )
    }
    return { checked: rows.length }
  },
)
