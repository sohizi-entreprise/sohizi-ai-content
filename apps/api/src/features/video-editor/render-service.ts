import { v4 as uuidv4 } from "uuid"
import * as repo from "./repo"
import {
  cancelRemoteRender,
  createRemoteRender,
  getRemoteRender,
  parseAllowedMediaHosts,
  type RemoteRenderJob,
} from "./render-client"
import { generateSignedDownloadUrl } from "../media-engine/storage"
import { BadRequest, Conflict, InternalServerError, NotFound } from "../error"
import type { CreateRenderInput, RenderComposition } from "./render-schema"
import type { VideoRenderJob } from "@/db/schema"

/**
 * Render jobs are owned by the API: the editor never talks to the Cloudflare
 * render service directly, and finished MP4s stay private in R2 behind a
 * short-lived signed URL.
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
  input: CreateRenderInput,
): Promise<RenderJobView> => {
  const composition = await assertCompositionAccess(compositionId, projectId)
  assertMediaHostsAllowed(input.composition)

  const existing = await repo.getActiveRenderJobForComposition(compositionId)
  if (existing) {
    const reconciled = await reconcileRenderJob(existing)
    // Re-submitting while a render is in flight returns the running job.
    if (isActive(reconciled)) return toView(reconciled)
  }

  const jobId = uuidv4()
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
  })

  let remote: RemoteRenderJob
  try {
    remote = await createRemoteRender({
      jobId,
      projectId,
      compositionId,
      fileName: input.fileName,
      composition: input.composition,
    })
  } catch (error) {
    await repo.updateRenderJob(jobId, {
      status: "failed",
      failureCode: "submit_failed",
      failureMessage:
        error instanceof Error ? error.message : "Could not start the render",
      finishedAt: new Date(),
    })
    throw error
  }

  return toView(await applyRemoteStatus(job, remote))
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

  await cancelRemoteRender(job.remoteJobId, projectId)
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

  if (job.status !== "completed" || !job.outputKey) {
    throw new Conflict("This render is not ready to download")
  }

  const { url } = await generateSignedDownloadUrl(job.outputKey, job.fileName)
  return { url, fileName: job.fileName, sizeInBytes: job.outputSizeInBytes }
}

// ============================================================================
// STATUS RECONCILIATION
// ============================================================================

function isActive(job: VideoRenderJob): boolean {
  return job.status === "queued" || job.status === "rendering"
}

/** Pulls the authoritative state from the render service into our own row. */
async function reconcileRenderJob(
  job: VideoRenderJob,
): Promise<VideoRenderJob> {
  if (!isActive(job)) return job

  const remote = await getRemoteRender(job.remoteJobId, job.projectId)
  if (!remote) {
    // The Workflow instance is gone, so no progress will ever arrive.
    return await update(job, {
      status: "failed",
      failureCode: "render_lost",
      failureMessage: "The render service no longer has this job",
      finishedAt: new Date(),
    })
  }

  return applyRemoteStatus(job, remote)
}

async function applyRemoteStatus(
  job: VideoRenderJob,
  remote: RemoteRenderJob,
): Promise<VideoRenderJob> {
  const progress = toPercent(remote.progress)

  if (remote.status === "completed") {
    if (!remote.outputKey) {
      return update(job, {
        status: "failed",
        failureCode: "missing_output",
        failureMessage: "The render finished without producing a file",
        finishedAt: new Date(),
      })
    }
    return update(job, {
      status: "completed",
      progress: 100,
      outputKey: remote.outputKey,
      outputSizeInBytes: remote.sizeInBytes ?? null,
      finishedAt: job.finishedAt ?? new Date(),
    })
  }

  if (remote.status === "failed") {
    return update(job, {
      status: "failed",
      failureCode: remote.error?.code ?? "render_failed",
      failureMessage: remote.error?.message ?? "The render failed",
      finishedAt: job.finishedAt ?? new Date(),
    })
  }

  if (remote.status === "cancelled") {
    return update(job, {
      status: "cancelled",
      finishedAt: job.finishedAt ?? new Date(),
    })
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
