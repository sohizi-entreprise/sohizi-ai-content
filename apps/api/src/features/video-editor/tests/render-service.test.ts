/**
 * Render job tests — the database, Remotion Lambda, R2 storage, and billing are
 * replaced with in-memory fakes so the lifecycle, credits, composition hash
 * caching, and status reconciliation rules can be exercised without infrastructure.
 * Run with `bun test`.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import {
  BadRequest,
  Conflict,
  InternalServerError,
  NotFound,
} from "../../error"
import { InsufficientCreditsError } from "../../billing/errors"
import * as renderService from "../render-service"
import { setRenderServiceDepsForTests } from "../render-service"
import type { VideoRenderJob } from "@/db/schema"
import type { RemoteRenderJob } from "../render-client"
import type { CreateRenderInput } from "../render-schema"
import type { UpsertExportedVideoInput } from "../repo"

const PROJECT_ID = randomUUID()
const OTHER_PROJECT_ID = randomUUID()
const COMPOSITION_ID = randomUUID()
const FOLDER_ID = randomUUID()
const OTHER_FOLDER_ID = randomUUID()
const USER_ID = "user_1"
const ORGANIZATION_ID = "org_1"

class RenderRateLimitError extends Error {
  readonly retryAfterMs?: number

  constructor(message: string, retryAfterMs?: number) {
    super(message)
    this.name = "RenderRateLimitError"
    this.retryAfterMs = retryAfterMs
  }
}

process.env.RENDER_ALLOWED_MEDIA_HOSTS = "cdn.sohizi.test"

// ----------------------------------------------------------------------------
// fakes
// ----------------------------------------------------------------------------

const jobs = new Map<string, VideoRenderJob>()

let composition: { id: string; projectId: string; version: number } | null =
  null
const folders = new Map<
  string,
  { id: string; projectId: string; directory: boolean }
>()
const upsertedFolderVideos: UpsertExportedVideoInput[] = []
const uploadedToR2: Array<{ sourceUrl: string; fileName: string }> = []
let remoteJobs = new Map<string, RemoteRenderJob>()
let createRemoteRenderError: Error | null = null
let reserveError: Error | null = null
const createdRemoteRenders: string[] = []
const cancelledRemoteRenders: string[] = []
const reservedKeys: string[] = []
const settledReservations: string[] = []
const settledInputs: Array<{
  reservationId: string
  providerCostUsd?: number
  metadata?: Record<string, unknown>
}> = []
const refundedReservations: string[] = []

function buildJob(overrides: Partial<VideoRenderJob> = {}): VideoRenderJob {
  const id = overrides.id ?? randomUUID()
  return {
    id,
    projectId: PROJECT_ID,
    compositionId: COMPOSITION_ID,
    folderId: FOLDER_ID,
    fileNodeId: null,
    compositionHash: null,
    userId: USER_ID,
    analyticsConsentId: null,
    status: "queued",
    compositionVersion: 1,
    fps: 30,
    width: 1920,
    height: 1080,
    durationInFrames: 300,
    fileName: "export.mp4",
    remoteJobId: id,
    billingReservationId: id,
    outputBucket: null,
    functionName: null,
    outputKey: null,
    outputUrl: null,
    outputStorageKey: null,
    outputSizeInBytes: null,
    progress: 0,
    failureCode: null,
    failureMessage: null,
    startedAt: null,
    finishedAt: null,
    capacityAccountId: null,
    capacityLease: null,
    userLease: null,
    submitState: null,
    cancelRequestedAt: null,
    pollerEnqueuedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function remote(overrides: Partial<RemoteRenderJob> = {}): RemoteRenderJob {
  return {
    jobId: "job",
    status: "rendering",
    progress: 0.5,
    renderedFrames: 150,
    frameCount: 300,
    ...overrides,
  }
}

const capacityReleases: Array<{ outcome: string; retryAfterMs?: number }> = []

function installRenderFakes() {
  setRenderServiceDepsForTests({
    repo: {
      getCompositionById: async (id: string) =>
        composition?.id === id ? composition : null,
      getFolderById: async (projectId: string, folderId: string) => {
        const folder = folders.get(folderId)
        if (!folder || folder.projectId !== projectId || !folder.directory) {
          return null
        }
        return folder
      },
      createRenderJob: async (data: Record<string, unknown>) => {
        const job = buildJob(data as Partial<VideoRenderJob>)
        jobs.set(job.id, job)
        return job
      },
      getRenderJobById: async (id: string) => jobs.get(id) ?? null,
      getActiveRenderJobForComposition: async (compositionId: string) =>
        [...jobs.values()]
          .reverse()
          .find(
            (job) =>
              job.compositionId === compositionId &&
              (job.status === "queued" || job.status === "rendering"),
          ) ?? null,
      getCompletedRenderJobByHash: async (
        compositionId: string,
        compositionHash: string,
      ) =>
        [...jobs.values()]
          .reverse()
          .find(
            (job) =>
              job.compositionId === compositionId &&
              job.compositionHash === compositionHash &&
              job.status === "completed" &&
              Boolean(job.outputUrl) &&
              Boolean(job.outputStorageKey),
          ) ?? null,
      upsertExportedVideoInFolder: async (input: UpsertExportedVideoInput) => {
        upsertedFolderVideos.push(input)
        return {
          fileNode: {
            id: `file-node-${upsertedFolderVideos.length}`,
            projectId: input.projectId,
            parentId: input.folderId,
            name: input.fileName,
          },
          asset: {
            id: `asset-${upsertedFolderVideos.length}`,
            url: input.url,
            storageKey: input.storageKey,
          },
        }
      },
      listRenderJobsForComposition: async (compositionId: string) =>
        [...jobs.values()].filter((job) => job.compositionId === compositionId),
      updateRenderJob: async (id: string, patch: Partial<VideoRenderJob>) => {
        const job = jobs.get(id)
        if (!job) return null
        const updated = { ...job, ...patch, updatedAt: new Date() }
        jobs.set(id, updated)
        return updated
      },
    } as never,
    estimateRenderCost: (async () => ({
      costUsd: 0.05,
      framesPerLambda: 20,
      lambdasInvoked: 16,
      memorySizeInMb: 2048,
      diskSizeInMb: 2048,
      region: "us-east-1",
    })) as never,
    createRemoteRender: (async (input: { jobId: string }) => {
      if (createRemoteRenderError) throw createRemoteRenderError
      createdRemoteRenders.push(input.jobId)
      const job = remote({
        jobId: input.jobId,
        status: "queued",
        progress: 0,
        renderedFrames: 0,
        outputBucket: "remotionlambda-test",
        functionName: "remotion-render-test",
      })
      remoteJobs.set(input.jobId, job)
      return job
    }) as never,
    getRemoteRender: (async (jobId: string) =>
      remoteJobs.get(jobId) ?? null) as never,
    cancelRemoteRender: (async (jobId: string) => {
      cancelledRemoteRenders.push(jobId)
      remoteJobs.delete(jobId)
    }) as never,
    presignRenderOutput: (async (input: {
      bucketName: string
      objectKey: string
      fileName: string
    }) => ({
      url: `https://signed.sohizi.test/${input.bucketName}/${input.objectKey}?name=${encodeURIComponent(input.fileName)}`,
    })) as never,
    uploadRenderToR2: (async (sourceUrl: string, fileName: string) => {
      uploadedToR2.push({ sourceUrl, fileName })
      return {
        url: `https://r2.sohizi.test/videos/${fileName}`,
        storageKey: `videos/key/${fileName}`,
        size: 2048,
      }
    }) as never,
    billingService: {
      reserve: async (input: { idempotencyKey: string; id?: string }) => {
        if (reserveError) throw reserveError
        reservedKeys.push(input.idempotencyKey)
        return {
          id: input.id ?? randomUUID(),
          status: "reserved",
          metadata: { estimatedCostUsd: 0.05 },
        }
      },
      settle: async (input: {
        reservationId: string
        providerCostUsd?: number
        metadata?: Record<string, unknown>
      }) => {
        settledReservations.push(input.reservationId)
        settledInputs.push(input)
        return { id: input.reservationId, status: "settled" }
      },
      refund: async (reservationId: string) => {
        refundedReservations.push(reservationId)
      },
      getReservation: async (reservationId: string) => ({
        id: reservationId,
        status: "reserved",
        metadata: { estimatedCostUsd: 0.05 },
      }),
      renewIfNearExpiry: async () => undefined,
    } as never,
    safeRefund: (async (
      _billing: unknown,
      reservationId: string | null | undefined,
    ) => {
      if (reservationId) refundedReservations.push(reservationId)
    }) as never,
    inngest: { send: async () => undefined } as never,
    tryAcquireCapacity: (async () => ({
      ok: true,
      selection: {
        account: {
          id: "remotion:primary",
          providerName: "remotion",
          adapter: "remotion",
          credential: "",
          strategy: "spread",
          limits: { maxConcurrency: 2, probeTtlMs: 30_000, cooldownMs: 15_000 },
          remotion: {
            region: "us-east-1",
            functionName: "remotion-render-test",
            serveUrl: "https://serve.test",
          },
        },
        binding: {
          providerName: "remotion",
          adapter: "remotion",
          apiName: "video.export",
          priority: 0,
        },
        lease: {
          poolId: "account:remotion:primary",
          holderId: "job",
          leaseId: "lease",
          epoch: 1,
          expiresAtMs: Date.now() + 60_000,
        },
      },
    })) as never,
    releaseCapacityLease: (async (
      _lease: unknown,
      outcome: string,
      options?: { retryAfterMs?: number },
    ) => {
      capacityReleases.push({ outcome, retryAfterMs: options?.retryAfterMs })
      return { ok: true }
    }) as never,
    renewCapacityLease: (async () => ({ ok: true })) as never,
    abortableSleep: (async () => undefined) as never,
    acquireUserSlot: (async () => null) as never,
    releaseUserSlot: (async () => ({ ok: true })) as never,
    renewUserSlot: (async () => ({ ok: true })) as never,
    userLimitToHttp: ((error: Error) => error) as never,
  })
}

// ----------------------------------------------------------------------------
// helpers
// ----------------------------------------------------------------------------

function snapshot(
  url = "https://cdn.sohizi.test/videos/a.mp4",
  overrides: Partial<CreateRenderInput> = {},
): CreateRenderInput {
  return {
    contractVersion: 1,
    folderId: FOLDER_ID,
    fileName: "export.mp4",
    composition: {
      fps: 30,
      width: 1920,
      height: 1080,
      durationInFrames: 300,
      tracks: [
        {
          id: "track-1",
          type: "video",
          name: "Video",
          muted: false,
          hidden: false,
          clips: [
            {
              id: "clip-1",
              trackId: "track-1",
              type: "video",
              startFrame: 0,
              endFrame: 300,
              sourceStartFrame: 0,
              sourceDurationInFrames: 300,
              url,
            },
          ],
        },
      ],
    },
    ...overrides,
  }
}

const create = (input: CreateRenderInput = snapshot()) =>
  renderService.createRender(
    COMPOSITION_ID,
    PROJECT_ID,
    USER_ID,
    ORGANIZATION_ID,
    input,
  )

beforeEach(() => {
  installRenderFakes()
  jobs.clear()
  folders.clear()
  folders.set(FOLDER_ID, {
    id: FOLDER_ID,
    projectId: PROJECT_ID,
    directory: true,
  })
  folders.set(OTHER_FOLDER_ID, {
    id: OTHER_FOLDER_ID,
    projectId: PROJECT_ID,
    directory: true,
  })
  upsertedFolderVideos.length = 0
  uploadedToR2.length = 0
  remoteJobs = new Map()
  createRemoteRenderError = null
  reserveError = null
  createdRemoteRenders.length = 0
  cancelledRemoteRenders.length = 0
  reservedKeys.length = 0
  settledReservations.length = 0
  settledInputs.length = 0
  refundedReservations.length = 0
  capacityReleases.length = 0
  composition = { id: COMPOSITION_ID, projectId: PROJECT_ID, version: 7 }
})

afterEach(() => {
  setRenderServiceDepsForTests(null)
})

// ----------------------------------------------------------------------------
// creation
// ----------------------------------------------------------------------------

describe("createRender", () => {
  test("records the job with compositionHash and folderId and submits it to the render service", async () => {
    const job = await create()

    expect(job.status).toBe("queued")
    expect(job.fileName).toBe("export.mp4")
    expect(job.folderId).toBe(FOLDER_ID)
    expect(createdRemoteRenders).toEqual([job.id])
    expect(jobs.get(job.id)?.compositionVersion).toBe(7)
    expect(jobs.get(job.id)?.compositionHash).toHaveLength(64)
  })

  test("rejects a composition from another project", async () => {
    composition = {
      id: COMPOSITION_ID,
      projectId: OTHER_PROJECT_ID,
      version: 1,
    }

    await expect(create()).rejects.toBeInstanceOf(NotFound)
    expect(createdRemoteRenders).toHaveLength(0)
  })

  test("rejects a folder that does not belong to the project", async () => {
    const unknownFolder = randomUUID()
    await expect(
      create(snapshot(undefined, { folderId: unknownFolder })),
    ).rejects.toBeInstanceOf(NotFound)
    expect(createdRemoteRenders).toHaveLength(0)
  })

  test("rejects media hosts outside the allowlist", async () => {
    const input = snapshot("https://evil.test/videos/a.mp4")

    await expect(
      renderService.createRender(
        COMPOSITION_ID,
        PROJECT_ID,
        USER_ID,
        ORGANIZATION_ID,
        input,
      ),
    ).rejects.toBeInstanceOf(BadRequest)
    expect(createdRemoteRenders).toHaveLength(0)
  })

  test("rejects a composition longer than 20 minutes", async () => {
    const input = snapshot()
    input.composition.durationInFrames = 30 * 60 * 20 + 1

    await expect(
      renderService.createRender(
        COMPOSITION_ID,
        PROJECT_ID,
        USER_ID,
        ORGANIZATION_ID,
        input,
      ),
    ).rejects.toBeInstanceOf(BadRequest)
    expect(createdRemoteRenders).toHaveLength(0)
    expect(reservedKeys).toHaveLength(0)
  })

  test("rejects when the organization cannot cover the estimate", async () => {
    reserveError = new InsufficientCreditsError(ORGANIZATION_ID, 10n, 0n)

    await expect(create()).rejects.toBeInstanceOf(BadRequest)
    expect(createdRemoteRenders).toHaveLength(0)
    expect([...jobs.values()]).toHaveLength(0)
  })

  test("returns the in-flight job instead of starting a second render", async () => {
    const first = await create()
    remoteJobs.set(
      first.id,
      remote({ jobId: first.id, status: "rendering", progress: 0.42 }),
    )

    const second = await create()

    expect(second.id).toBe(first.id)
    expect(second.status).toBe("rendering")
    expect(second.progress).toBe(42)
    expect(createdRemoteRenders).toEqual([first.id])
  })

  test("reuses the already generated url when re-exporting an identical composition", async () => {
    const first = await create()
    remoteJobs.set(
      first.id,
      remote({
        jobId: first.id,
        status: "completed",
        progress: 1,
        outputKey: "renders/a.mp4",
        sizeInBytes: 4096,
      }),
    )

    const second = await create(
      snapshot(undefined, {
        folderId: OTHER_FOLDER_ID,
        fileName: "renamed.mp4",
      }),
    )

    expect(second.id).toBe(first.id)
    expect(second.status).toBe("completed")
    expect(second.outputUrl).toBe("https://r2.sohizi.test/videos/renamed.mp4")
    expect(second.folderId).toBe(OTHER_FOLDER_ID)
    expect(second.fileName).toBe("renamed.mp4")
    expect(createdRemoteRenders).toEqual([first.id])
    expect(reservedKeys).toHaveLength(1)
    expect(uploadedToR2).toHaveLength(1)
    expect(upsertedFolderVideos.at(-1)).toMatchObject({
      projectId: PROJECT_ID,
      folderId: OTHER_FOLDER_ID,
      fileName: "renamed.mp4",
      url: "https://r2.sohizi.test/videos/renamed.mp4",
      storageKey: "videos/key/renamed.mp4",
    })
  })

  test("starts a new render when the composition changed after a completed render", async () => {
    const first = await create(snapshot("https://cdn.sohizi.test/videos/a.mp4"))
    remoteJobs.set(
      first.id,
      remote({
        jobId: first.id,
        status: "completed",
        progress: 1,
        outputKey: "renders/a.mp4",
      }),
    )

    const second = await create(
      snapshot("https://cdn.sohizi.test/videos/b.mp4"),
    )

    expect(second.id).not.toBe(first.id)
    expect(createdRemoteRenders).toEqual([first.id, second.id])
  })

  test("marks the job failed when submission is rejected", async () => {
    createRemoteRenderError = new BadRequest(
      "This composition cannot be rendered",
    )

    await expect(create()).rejects.toBeInstanceOf(BadRequest)

    const stored = [...jobs.values()]
    expect(stored).toHaveLength(1)
    expect(stored[0].status).toBe("failed")
    expect(stored[0].failureCode).toBe("submit_failed")
    expect(refundedReservations).toHaveLength(1)
  })

  test("a render 429 passes its retry hint and a server error does not", async () => {
    createRemoteRenderError = new RenderRateLimitError("limited", 2_500)
    await expect(create()).rejects.toBeInstanceOf(RenderRateLimitError)
    expect(capacityReleases.at(-1)).toEqual({
      outcome: "rate_limited",
      retryAfterMs: 2_500,
    })

    capacityReleases.length = 0
    createRemoteRenderError = new InternalServerError(
      "Could not start the render",
    )
    await expect(create()).rejects.toBeInstanceOf(InternalServerError)
    expect(capacityReleases.at(-1)).toEqual({
      outcome: "rate_limited",
      retryAfterMs: undefined,
    })
  })
})

// ----------------------------------------------------------------------------
// status reconciliation
// ----------------------------------------------------------------------------

describe("getRender", () => {
  test("is scoped to the project that owns the job", async () => {
    const job = await create()

    await expect(
      renderService.getRender(job.id, OTHER_PROJECT_ID),
    ).rejects.toBeInstanceOf(NotFound)
  })

  test("uploads to R2, saves into the target folder, and stores the output url when the render completes", async () => {
    const job = await create()
    remoteJobs.set(
      job.id,
      remote({
        jobId: job.id,
        status: "completed",
        progress: 1,
        outputKey: `renders/${PROJECT_ID}/${job.id}.mp4`,
        sizeInBytes: 2048,
      }),
    )

    const status = await renderService.getRender(job.id, PROJECT_ID)

    expect(status.status).toBe("completed")
    expect(status.progress).toBe(100)
    expect(status.sizeInBytes).toBe(2048)
    expect(status.outputUrl).toBe("https://r2.sohizi.test/videos/export.mp4")
    expect(status.fileNodeId).toBe("file-node-1")
    expect(status.finishedAt).not.toBeNull()
    expect(jobs.get(job.id)?.outputKey).toBe(
      `renders/${PROJECT_ID}/${job.id}.mp4`,
    )
    expect(jobs.get(job.id)?.outputUrl).toBe(
      "https://r2.sohizi.test/videos/export.mp4",
    )
    expect(uploadedToR2).toHaveLength(1)
    expect(upsertedFolderVideos).toEqual([
      {
        projectId: PROJECT_ID,
        folderId: FOLDER_ID,
        fileName: "export.mp4",
        url: "https://r2.sohizi.test/videos/export.mp4",
        storageKey: "videos/key/export.mp4",
        sizeInBytes: 2048,
      },
    ])
    expect(settledReservations).toEqual([job.id])
    expect(settledInputs).toEqual([
      {
        reservationId: job.id,
        actualCredits: expect.any(BigInt),
        providerCostUsd: 0.05,
        metadata: {
          renderJobId: job.id,
          vendor: "remotion",
          providerCostUsd: 0.05,
          accruedCostUsd: undefined,
          estimatedCostUsd: 0.05,
        },
      },
    ])
  })

  test("surfaces a sanitized failure", async () => {
    const job = await create()
    remoteJobs.set(
      job.id,
      remote({
        jobId: job.id,
        status: "failed",
        error: { code: "container_error", message: "Render crashed" },
      }),
    )

    const status = await renderService.getRender(job.id, PROJECT_ID)

    expect(status.status).toBe("failed")
    expect(status.error).toEqual({
      code: "container_error",
      message: "Render crashed",
    })
    expect(refundedReservations).toEqual([job.id])
  })

  test("keeps an in-flight job when progress is temporarily unavailable", async () => {
    const job = await create()
    remoteJobs.set(
      job.id,
      remote({
        jobId: job.id,
        status: "rendering",
        progress: 0.4,
        stale: true,
      }),
    )

    const status = await renderService.getRender(job.id, PROJECT_ID)

    expect(status.status).toBe("rendering")
    expect(status.error).toBeNull()
    expect(refundedReservations).toHaveLength(0)
  })

  test("fails a job the render service no longer knows about", async () => {
    const job = await create()
    remoteJobs.delete(job.id)

    const status = await renderService.getRender(job.id, PROJECT_ID)

    expect(status.status).toBe("failed")
    expect(status.error?.code).toBe("render_lost")
    expect(refundedReservations).toEqual([job.id])
  })

  test("does not poll a job that already reached a terminal state", async () => {
    const job = buildJob({
      status: "completed",
      progress: 100,
      outputKey: "renders/a.mp4",
    })
    jobs.set(job.id, job)

    const status = await renderService.getRender(job.id, PROJECT_ID)

    expect(status.status).toBe("completed")
    expect(status.progress).toBe(100)
  })
})

// ----------------------------------------------------------------------------
// cancellation and download
// ----------------------------------------------------------------------------

describe("cancelRender", () => {
  test("cancels an in-flight render", async () => {
    const job = await create()

    const cancelled = await renderService.cancelRender(job.id, PROJECT_ID)

    expect(cancelled.status).toBe("cancelled")
    expect(cancelledRemoteRenders).toEqual([job.id])
    expect(jobs.get(job.id)?.finishedAt).not.toBeNull()
    expect(refundedReservations).toEqual([job.id])
  })

  test("refuses to cancel a completed render", async () => {
    const job = buildJob({ status: "completed", outputKey: "renders/a.mp4" })
    jobs.set(job.id, job)

    await expect(
      renderService.cancelRender(job.id, PROJECT_ID),
    ).rejects.toBeInstanceOf(Conflict)
  })
})

describe("getRenderDownload", () => {
  test("signs the private output once the render completed", async () => {
    const job = buildJob({
      status: "completed",
      progress: 100,
      outputBucket: "remotionlambda-test",
      outputKey: `renders/${PROJECT_ID}/out.mp4`,
      outputSizeInBytes: 4096,
    })
    jobs.set(job.id, job)

    const download = await renderService.getRenderDownload(job.id, PROJECT_ID)

    expect(download.url).toContain(`renders/${PROJECT_ID}/out.mp4`)
    expect(download.fileName).toBe("export.mp4")
    expect(download.sizeInBytes).toBe(4096)
  })

  test("refuses to sign an unfinished render", async () => {
    const job = await create()

    await expect(
      renderService.getRenderDownload(job.id, PROJECT_ID),
    ).rejects.toBeInstanceOf(Conflict)
  })
})
