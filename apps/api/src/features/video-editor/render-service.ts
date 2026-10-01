import { v4 as uuidv4 } from "uuid"
import * as repo from "./repo"
import {
  cancelRemoteRender,
  createRemoteRender,
  estimateRenderCost,
  getRemoteRender,
  parseAllowedMediaHosts,
  presignRenderOutput,
  type RemoteRenderJob,
} from "./render-client"
import {
  EXPORT_TOO_LONG_MESSAGE,
  isExportTooLong,
  type CreateRenderInput,
  type RenderComposition,
} from "./render-schema"
import { RENDER_RESERVATION_TTL_MS, lambdaUsdToCredits } from "./render-pricing"
import { inngest } from "@/lib/inngest/client"
import {
  billingService,
  InsufficientCreditsError,
  safeRefund,
} from "@/features/billing"
import { BadRequest, Conflict, InternalServerError, NotFound } from "../error"
import type { VideoRenderJob } from "@/db/schema"

/**
 * Render jobs are owned by the API: the editor never talks to Remotion Lambda
 * directly. Finished MP4s stay private in S3 behind a short-lived signed URL.
 */

export type RenderJobView = {
  id: string
  status: VideoRenderJob["status"]
  /** Percentage, 0-100. */
  progress: number
  fileName: string
  fps: number
  width: number
  height: number
  durationInFrames: number
  sizeInBytes: number | null
  error: { code: string; message: string } | null
  createdAt: Date
  startedAt: Date | null
  finishedAt: Date | null
}

export const createRender = async (
  compositionId: string,
  projectId: string,
  userId: string,
  organizationId: string,
  input: CreateRenderInput,
): Promise<RenderJobView> => {
  const composition = await assertCompositionAccess(compositionId, projectId)
  assertMediaHostsAllowed(input.composition)
  assertExportDuration(input.composition)

  const existing = await repo.getActiveRenderJobForComposition(compositionId)
  if (existing) {
    const reconciled = await reconcileRenderJob(existing)
    if (isActive(reconciled)) return toView(reconciled)
  }

  const jobId = uuidv4()
  const estimate = await estimateRenderCost(input.composition)
  const estimatedCredits = lambdaUsdToCredits(estimate.costUsd, {
    overbook: true,
  })

  let reservationId: string
  try {
    const reservation = await billingService.reserve({
      organizationId,
      userId,
      operation: "video-export",
      estimatedCredits,
      ttlMs: RENDER_RESERVATION_TTL_MS,
      id: jobId,
      idempotencyKey: `render:${jobId}`,
      metadata: {
        projectId,
        compositionId,
        estimatedCostUsd: estimate.costUsd,
      },
    })
    reservationId = reservation.id
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      throw new BadRequest(
        "You don't have enough credits to export this video.",
      )
    }
    throw error
  }

  const job = await repo.createRenderJob({
    id: jobId,
    projectId,
    compositionId,
    userId,
    compositionVersion: composition.version,
    fps: input.composition.fps,
    width: input.composition.width,
    height: input.composition.height,
    durationInFrames: input.composition.durationInFrames,
    fileName: input.fileName,
    remoteJobId: jobId,
    billingReservationId: reservationId,
    functionName: process.env.REMOTION_FUNCTION_NAME ?? null,
  })

  let remote: RemoteRenderJob
  try {
    remote = await createRemoteRender({
      jobId,
      projectId,
      compositionId,
      fileName: input.fileName,
      composition: input.composition,
      concurrency: estimate.concurrency,
    })
  } catch (error) {
    await safeRefund(billingService, reservationId, "render-submit-failed")
    await repo.updateRenderJob(jobId, {
      status: "failed",
      failureCode: "submit_failed",
      failureMessage:
        error instanceof Error ? error.message : "Could not start the render",
      finishedAt: new Date(),
    })
    throw error
  }

  const submitted = await repo.updateRenderJob(jobId, {
    remoteJobId: remote.jobId,
    outputBucket: remote.outputBucket ?? null,
    functionName: remote.functionName ?? process.env.REMOTION_FUNCTION_NAME,
  })

  await enqueueRenderPoll(jobId, projectId)

  return toView(await applyRemoteStatus(submitted ?? job, remote))
}

export const getRender = async (
  renderJobId: string,
  projectId: string,
): Promise<RenderJobView> => {
  const job = await loadJob(renderJobId, projectId)
  return toView(await reconcileRenderJob(job))
}

export const listRenders = async (
  compositionId: string,
  projectId: string,
): Promise<RenderJobView[]> => {
  await assertCompositionAccess(compositionId, projectId)
  const jobs = await repo.listRenderJobsForComposition(compositionId)
  return jobs.map(toView)
}

export const cancelRender = async (
  renderJobId: string,
  projectId: string,
): Promise<RenderJobView> => {
  const job = await loadJob(renderJobId, projectId)
  if (job.status === "completed") {
    throw new Conflict("This render already finished")
  }
  if (!isActive(job)) return toView(job)

  await cancelRemoteRender(job.remoteJobId, {
    bucketName: job.outputBucket,
    functionName: job.functionName,
  })
  await refundRender(job, "render-cancelled")
  const cancelled = await repo.updateRenderJob(job.id, {
    status: "cancelled",
    finishedAt: new Date(),
  })
  return toView(cancelled ?? job)
}

export const getRenderDownload = async (
  renderJobId: string,
  projectId: string,
): Promise<{ url: string; fileName: string; sizeInBytes: number | null }> => {
  const job = await reconcileRenderJob(await loadJob(renderJobId, projectId))

  if (job.status !== "completed" || !job.outputKey || !job.outputBucket) {
    throw new Conflict("This render is not ready to download")
  }

  const { url } = await presignRenderOutput({
    bucketName: job.outputBucket,
    objectKey: job.outputKey,
    fileName: job.fileName,
  })
  return { url, fileName: job.fileName, sizeInBytes: job.outputSizeInBytes }
}

// ============================================================================
// STATUS RECONCILIATION
// ============================================================================

function isActive(job: VideoRenderJob): boolean {
  return job.status === "queued" || job.status === "rendering"
}

/** Pulls the authoritative state from Lambda into our own row. */
export async function reconcileRenderJob(
  job: VideoRenderJob,
): Promise<VideoRenderJob> {
  if (!isActive(job)) return job

  const remote = await getRemoteRender(job.remoteJobId, {
    bucketName: job.outputBucket,
    functionName: job.functionName,
  })
  if (!remote) {
    const lost = await update(job, {
      status: "failed",
      failureCode: "render_lost",
      failureMessage: "The render service no longer has this job",
      finishedAt: new Date(),
    })
    await refundRender(lost, "render-lost")
    return lost
  }

  return applyRemoteStatus(job, remote)
}

async function applyRemoteStatus(
  job: VideoRenderJob,
  remote: RemoteRenderJob,
): Promise<VideoRenderJob> {
  if (remote.stale) {
    return update(job, {
      status: job.status === "queued" ? "rendering" : job.status,
      startedAt: job.startedAt ?? new Date(),
    })
  }

  const progress = toPercent(remote.progress)

  if (remote.status === "completed") {
    if (!remote.outputKey) {
      const failed = await update(job, {
        status: "failed",
        failureCode: "missing_output",
        failureMessage: "The render finished without producing a file",
        finishedAt: new Date(),
      })
      await refundRender(failed, "render-missing-output")
      return failed
    }
    const completed = await update(job, {
      status: "completed",
      progress: 100,
      outputKey: remote.outputKey,
      outputBucket: remote.outputBucket ?? job.outputBucket,
      outputSizeInBytes: remote.sizeInBytes ?? null,
      finishedAt: job.finishedAt ?? new Date(),
    })
    await settleRender(completed, remote.accruedCostUsd)
    return completed
  }

  if (remote.status === "failed") {
    const failed = await update(job, {
      status: "failed",
      failureCode: remote.error?.code ?? "render_failed",
      failureMessage: remote.error?.message ?? "The render failed",
      finishedAt: job.finishedAt ?? new Date(),
    })
    await refundRender(failed, "render-failed")
    return failed
  }

  if (remote.status === "cancelled") {
    const cancelled = await update(job, {
      status: "cancelled",
      finishedAt: job.finishedAt ?? new Date(),
    })
    await refundRender(cancelled, "render-cancelled")
    return cancelled
  }

  if (remote.status === "rendering") {
    return update(job, {
      status: "rendering",
      progress,
      startedAt: job.startedAt ?? new Date(),
    })
  }

  return update(job, { status: "queued", progress })
}

/** Skips the write when nothing actually moved, since status is polled often. */
async function update(
  job: VideoRenderJob,
  patch: repo.UpdateRenderJobData,
): Promise<VideoRenderJob> {
  const changed = Object.entries(patch).some(([key, value]) => {
    const current = job[key as keyof VideoRenderJob]
    if (value instanceof Date && current instanceof Date) {
      return value.getTime() !== current.getTime()
    }
    return value !== current
  })
  if (!changed) return job

  const updated = await repo.updateRenderJob(job.id, patch)
  return updated ?? job
}

function toPercent(progress: number): number {
  if (!Number.isFinite(progress)) return 0
  return Math.min(100, Math.max(0, Math.round(progress * 100)))
}

async function settleRender(
  job: VideoRenderJob,
  accruedCostUsd: number | undefined,
): Promise<void> {
  if (!job.billingReservationId) return
  const reservation = await billingService.getReservation(
    job.billingReservationId,
  )
  if (!reservation || reservation.status !== "reserved") return

  const estimatedCostUsd = Number(reservation.metadata?.estimatedCostUsd)
  const costUsd =
    typeof accruedCostUsd === "number" && Number.isFinite(accruedCostUsd)
      ? accruedCostUsd
      : Number.isFinite(estimatedCostUsd)
        ? estimatedCostUsd
        : 0

  await billingService.settle({
    reservationId: job.billingReservationId,
    actualCredits: lambdaUsdToCredits(costUsd, { overbook: false }),
    metadata: {
      renderJobId: job.id,
      accruedCostUsd,
      estimatedCostUsd,
    },
  })
}

async function refundRender(
  job: VideoRenderJob,
  reason: string,
): Promise<void> {
  await safeRefund(billingService, job.billingReservationId, reason)
}

async function enqueueRenderPoll(
  renderJobId: string,
  projectId: string,
): Promise<void> {
  try {
    await inngest.send({
      name: "video-editor/render.poll",
      data: { renderJobId, projectId },
    })
  } catch (error) {
    console.error("[render] failed to enqueue poller", renderJobId, error)
  }
}

// ============================================================================
// HELPERS
// ============================================================================

async function loadJob(
  renderJobId: string,
  projectId: string,
): Promise<VideoRenderJob> {
  const job = await repo.getRenderJobById(renderJobId)
  if (!job || job.projectId !== projectId) {
    throw new NotFound("Render job not found")
  }
  return job
}

async function assertCompositionAccess(
  compositionId: string,
  projectId: string,
) {
  const composition = await repo.getCompositionById(compositionId)
  if (!composition || composition.projectId !== projectId) {
    throw new NotFound("Composition not found")
  }
  return composition
}

function assertExportDuration(composition: RenderComposition): void {
  if (isExportTooLong(composition.durationInFrames, composition.fps)) {
    throw new BadRequest(EXPORT_TOO_LONG_MESSAGE)
  }
}

function assertMediaHostsAllowed(composition: RenderComposition): void {
  const allowed = parseAllowedMediaHosts()
  if (allowed.length === 0) {
    console.error("RENDER_ALLOWED_MEDIA_HOSTS is not set")
    throw new InternalServerError("Rendering is not configured")
  }

  const rejected = new Set<string>()
  for (const track of composition.tracks) {
    for (const clip of track.clips) {
      if (
        clip.type !== "video" &&
        clip.type !== "audio" &&
        clip.type !== "image"
      )
        continue
      if (!clip.url) {
        throw new BadRequest(`Clip ${clip.id} is missing its media url`)
      }
      let hostname: string
      try {
        hostname = new URL(clip.url).hostname.toLowerCase()
      } catch {
        throw new BadRequest(`Clip ${clip.id} has an unparsable url`)
      }
      const isAllowed = allowed.some(
        (entry) => hostname === entry || hostname.endsWith(`.${entry}`),
      )
      if (!isAllowed) rejected.add(hostname)
    }
  }

  if (rejected.size > 0) {
    throw new BadRequest(
      `Media host is not allowed for rendering: ${[...rejected].join(", ")}`,
    )
  }
}

function toView(job: VideoRenderJob): RenderJobView {
  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    fileName: job.fileName,
    fps: job.fps,
    width: job.width,
    height: job.height,
    durationInFrames: job.durationInFrames,
    sizeInBytes: job.outputSizeInBytes,
    error: job.failureMessage
      ? {
          code: job.failureCode ?? "render_failed",
          message: job.failureMessage,
        }
      : null,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
  }
}
