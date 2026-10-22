import { inngest } from "@/lib/inngest/client"
import { captureUnexpectedError } from "@/sentry"
import { runSweepBatches } from "@/features/billing/inngest"
import { purgeExpiredAssets } from "./asset-retention"

export const sweepExpiredAssets = inngest.createFunction(
  {
    id: "asset-expiration-sweep",
    triggers: [{ cron: "15 * * * *" }],
    concurrency: { limit: 1 },
    retries: 3,
    onFailure: async ({ event }) => {
      captureUnexpectedError(event.data.error, {
        job: "asset-expiration-sweep",
      })
    },
  },
  async ({ step }) => {
    const run = (id: string, fn: () => Promise<number>) => step.run(id, fn)
    const expired = await runSweepBatches({
      name: "expired-assets",
      sweep: (limit) => purgeExpiredAssets(limit),
      run,
    })
    if (expired.backlogPossible) {
      console.warn("[assets] expiration sweep reached its batch limit")
    }
    return {
      assetsExpired: expired.processed,
      backlogPossible: expired.backlogPossible,
    }
  },
)
