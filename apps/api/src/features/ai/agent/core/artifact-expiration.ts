import { inngest } from "@/lib/inngest/client"
import { captureUnexpectedError } from "@/sentry"
import { runSweepBatches } from "@/features/billing/inngest"
import { deleteExpiredArtifacts } from "./context-artifacts"

export const sweepExpiredArtifacts = inngest.createFunction(
  {
    id: "context-artifact-expiration-sweep",
    triggers: [{ cron: "0 * * * *" }],
    concurrency: { limit: 1 },
    retries: 3,
    onFailure: async ({ event }) => {
      captureUnexpectedError(event.data.error, {
        job: "context-artifact-expiration-sweep",
      })
    },
  },
  async ({ step }) => {
    const run = (id: string, fn: () => Promise<number>) => step.run(id, fn)
    const artifacts = await runSweepBatches({
      name: "context-artifacts",
      sweep: (limit) => deleteExpiredArtifacts(limit),
      run,
    })
    if (artifacts.backlogPossible) {
      console.warn("[context] artifact expiration sweep reached its batch limit")
    }
    return {
      artifactsExpired: artifacts.processed,
      backlogPossible: artifacts.backlogPossible,
    }
  },
)
