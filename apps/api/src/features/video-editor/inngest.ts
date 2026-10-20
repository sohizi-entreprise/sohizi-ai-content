import { inngest } from "@/lib/inngest/client"
import { billingService, safeRefund } from "@/features/billing"
import * as repo from "./repo"
import {
  reconcileRenderJob,
  releaseRenderCapacity,
  renewRenderCapacity,
} from "./render-service"
import { RENDER_RESERVATION_TTL_MS } from "./render-pricing"
import { captureUnexpectedError } from "@/sentry"

const POLL_INTERVAL = "5s"
const MAX_POLL_ATTEMPTS = 360

type RenderPollEventData = {
  renderJobId: string
  projectId: string
}

function isActiveStatus(status: string | undefined): boolean {
  return status === "queued" || status === "rendering"
}

export const handleVideoExportPoll = inngest.createFunction(
  {
    id: "video-editor-render-poll",
    retries: 0,
    triggers: [{ event: "video-editor/render.poll" }],
    onFailure: async ({ event }) => {
      const data = event.data.event.data as RenderPollEventData
      captureUnexpectedError(event.data.error, {
        job: "video-editor-render-poll",
        project_id: data.projectId,
        render_job_id: data.renderJobId,
      })
      const job = await repo.getRenderJobById(data.renderJobId)
      if (!job || !isActiveStatus(job.status)) return
      await safeRefund(
        billingService,
        job.billingReservationId,
        "render-poller-failed",
      )
      await releaseRenderCapacity(data.renderJobId).catch((error) => {
        console.error(
          "[render] failure release failed",
          data.renderJobId,
          error,
        )
      })
    },
  },
  async ({ event, step }) => {
    const { renderJobId, projectId } = event.data as RenderPollEventData

    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      await step.sleep(`wait-for-render-${attempt}`, POLL_INTERVAL)

      const result = await step.run(`poll-render-${attempt}`, async () => {
        const job = await repo.getRenderJobById(renderJobId)
        if (!job || job.projectId !== projectId) {
          return { done: true as const, status: job?.status ?? "missing" }
        }
        if (!isActiveStatus(job.status)) {
          return { done: true as const, status: job.status }
        }
        if (job.billingReservationId) {
          await billingService.renewIfNearExpiry(
            job.billingReservationId,
            RENDER_RESERVATION_TTL_MS,
          )
        }
        await renewRenderCapacity(job)
        const reconciled = await reconcileRenderJob(job)
        return {
          done: !isActiveStatus(reconciled.status),
          status: reconciled.status,
        }
      })

      if (result.done) {
        await step.run("release-render-capacity", () =>
          releaseRenderCapacity(renderJobId),
        )
        return result
      }
    }

    await step.run("fail-on-poll-timeout", async () => {
      const job = await repo.getRenderJobById(renderJobId)
      if (!job || !isActiveStatus(job.status)) return
      await repo.updateRenderJob(job.id, {
        status: "failed",
        failureCode: "render_timeout",
        failureMessage: "The export timed out",
        finishedAt: new Date(),
      })
      await safeRefund(
        billingService,
        job.billingReservationId,
        "render-timeout",
      )
      await releaseRenderCapacity(job.id)
    })

    return { done: true as const, status: "failed" }
  },
)
