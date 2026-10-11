import { inngest } from "@/lib/inngest/client"
import { billingService } from "./service"
import { captureUnexpectedError } from "@/sentry"

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
