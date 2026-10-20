import { inngest } from "@/lib/inngest/client"
import { listMediaJobsMissingPoller } from "@/features/generation-request/repo"
import { getProjectById } from "@/features/project/repo"
import { listRendersMissingPoller } from "@/features/video-editor/repo"

export const recoverStuckJobs = inngest.createFunction(
  {
    id: "capacity-recover-stuck-jobs",
    retries: 0,
    triggers: [{ cron: "*/2 * * * *" }],
  },
  async () => {
    const olderThan = new Date(Date.now() - 60_000)
    const media = await listMediaJobsMissingPoller(olderThan)
    let mediaSent = 0
    for (const job of media) {
      const project = await getProjectById(job.projectId)
      if (!project) continue
      const request = job.request as {
        model?: string
        settings?: Record<string, unknown>
        context?: { referenceFiles?: unknown[]; mediaType?: string }
      } | null
      const mediaType = request?.context?.mediaType
      await inngest.send({
        name: "media/generate",
        data: {
          requestId: job.id,
          projectId: job.projectId,
          organizationId: project.organizationId,
          userId: job.userId,
          model: request?.model ?? "",
          payload: request?.settings ?? {},
          referenceFiles: request?.context?.referenceFiles ?? [],
          mediaType:
            mediaType === "video" || mediaType === "audio"
              ? mediaType
              : "image",
          _reservationId: job.id,
        },
      })
      mediaSent += 1
    }

    const renders = await listRendersMissingPoller(olderThan)
    for (const job of renders) {
      await inngest.send({
        name: "video-editor/render.poll",
        data: { renderJobId: job.id, projectId: job.projectId },
      })
    }

    return { media: mediaSent, renders: renders.length }
  },
)
