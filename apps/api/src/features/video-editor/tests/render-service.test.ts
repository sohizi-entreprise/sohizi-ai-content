/**
 * Render job tests — the database and the Cloudflare render service are both
 * replaced with in-memory fakes so the lifecycle, idempotency, ownership and
 * status reconciliation rules can be exercised without infrastructure.
 * Run with `bun test`.
 */

import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { BadRequest, Conflict, NotFound } from '../../error'
import type { VideoRenderJob } from '@/db/schema'
import type { RemoteRenderJob } from '../render-client'
import type { CreateRenderInput } from '../render-schema'

const PROJECT_ID = randomUUID()
const OTHER_PROJECT_ID = randomUUID()
const COMPOSITION_ID = randomUUID()
const USER_ID = 'user_1'

process.env.RENDER_ALLOWED_MEDIA_HOSTS = 'cdn.sohizi.test'

// ----------------------------------------------------------------------------
// fakes
// ----------------------------------------------------------------------------

const jobs = new Map<string, VideoRenderJob>()

let composition: { id: string; projectId: string; version: number } | null =
  null
let remoteJobs = new Map<string, RemoteRenderJob>()
let createRemoteRenderError: Error | null = null
const createdRemoteRenders: string[] = []
const cancelledRemoteRenders: string[] = []

function buildJob(overrides: Partial<VideoRenderJob> = {}): VideoRenderJob {
  const id = overrides.id ?? randomUUID()
  return {
    id,
    projectId: PROJECT_ID,
    compositionId: COMPOSITION_ID,
    userId: USER_ID,
    status: 'queued',
    compositionVersion: 1,
    fps: 30,
    width: 1920,
    height: 1080,
    durationInFrames: 300,
    fileName: 'export.mp4',
    remoteJobId: id,
    outputKey: null,
    outputSizeInBytes: null,
    progress: 0,
    failureCode: null,
    failureMessage: null,
    startedAt: null,
    finishedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function remote(overrides: Partial<RemoteRenderJob> = {}): RemoteRenderJob {
  return {
    jobId: 'job',
    status: 'rendering',
    progress: 0.5,
    renderedFrames: 150,
    frameCount: 300,
    ...overrides,
  }
}

mock.module('../repo', () => ({
  getCompositionById: async (id: string) =>
    composition?.id === id ? composition : null,
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
          (job.status === 'queued' || job.status === 'rendering'),
      ) ?? null,
  listRenderJobsForComposition: async (compositionId: string) =>
    [...jobs.values()].filter((job) => job.compositionId === compositionId),
  updateRenderJob: async (id: string, patch: Partial<VideoRenderJob>) => {
    const job = jobs.get(id)
    if (!job) return null
    const updated = { ...job, ...patch, updatedAt: new Date() }
    jobs.set(id, updated)
    return updated
  },
}))

mock.module('../render-client', () => ({
  parseAllowedMediaHosts: () => ['cdn.sohizi.test'],
  createRemoteRender: async (input: { jobId: string }) => {
    if (createRemoteRenderError) throw createRemoteRenderError
    createdRemoteRenders.push(input.jobId)
    const job = remote({
      jobId: input.jobId,
      status: 'queued',
      progress: 0,
      renderedFrames: 0,
    })
    remoteJobs.set(input.jobId, job)
    return job
  },
  getRemoteRender: async (jobId: string) => remoteJobs.get(jobId) ?? null,
  cancelRemoteRender: async (jobId: string) => {
    cancelledRemoteRenders.push(jobId)
    remoteJobs.delete(jobId)
  },
}))

mock.module('../../media-engine/storage', () => ({
  generateSignedDownloadUrl: async (storageKey: string, fileName: string) => ({
    url: `https://signed.sohizi.test/${storageKey}?name=${encodeURIComponent(fileName)}`,
  }),
}))

const renderService = await import('../render-service')

// ----------------------------------------------------------------------------
// helpers
// ----------------------------------------------------------------------------

function snapshot(
  url = 'https://cdn.sohizi.test/videos/a.mp4',
): CreateRenderInput {
  return {
    contractVersion: 1,
    fileName: 'export.mp4',
    composition: {
      fps: 30,
      width: 1920,
      height: 1080,
      durationInFrames: 300,
      tracks: [
        {
          id: 'track-1',
          type: 'video',
          name: 'Video',
          muted: false,
          hidden: false,
          clips: [
            {
              id: 'clip-1',
              trackId: 'track-1',
              type: 'video',
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
  }
}

const create = () =>
  renderService.createRender(COMPOSITION_ID, PROJECT_ID, USER_ID, snapshot())

beforeEach(() => {
  jobs.clear()
  remoteJobs = new Map()
  createRemoteRenderError = null
  createdRemoteRenders.length = 0
  cancelledRemoteRenders.length = 0
  composition = { id: COMPOSITION_ID, projectId: PROJECT_ID, version: 7 }
})

// ----------------------------------------------------------------------------
// creation
// ----------------------------------------------------------------------------

describe('createRender', () => {
  test('records the job and submits it to the render service', async () => {
    const job = await create()

    expect(job.status).toBe('queued')
    expect(job.fileName).toBe('export.mp4')
    expect(createdRemoteRenders).toEqual([job.id])
    expect(jobs.get(job.id)?.compositionVersion).toBe(7)
  })

  test('rejects a composition from another project', async () => {
    composition = {
      id: COMPOSITION_ID,
      projectId: OTHER_PROJECT_ID,
      version: 1,
    }

    await expect(create()).rejects.toBeInstanceOf(NotFound)
    expect(createdRemoteRenders).toHaveLength(0)
  })

  test('rejects media hosts outside the allowlist', async () => {
    const input = snapshot('https://evil.test/videos/a.mp4')

    await expect(
      renderService.createRender(COMPOSITION_ID, PROJECT_ID, USER_ID, input),
    ).rejects.toBeInstanceOf(BadRequest)
    expect(createdRemoteRenders).toHaveLength(0)
  })

  test('returns the in-flight job instead of starting a second render', async () => {
    const first = await create()
    remoteJobs.set(
      first.id,
      remote({ jobId: first.id, status: 'rendering', progress: 0.42 }),
    )

    const second = await create()

    expect(second.id).toBe(first.id)
    expect(second.status).toBe('rendering')
    expect(second.progress).toBe(42)
    expect(createdRemoteRenders).toEqual([first.id])
  })

  test('starts a new render once the previous one finished', async () => {
    const first = await create()
    remoteJobs.set(
      first.id,
      remote({
        jobId: first.id,
        status: 'completed',
        progress: 1,
        outputKey: 'renders/a.mp4',
      }),
    )

    const second = await create()

    expect(second.id).not.toBe(first.id)
    expect(createdRemoteRenders).toEqual([first.id, second.id])
  })

  test('marks the job failed when submission is rejected', async () => {
    createRemoteRenderError = new BadRequest(
      'This composition cannot be rendered',
    )

    await expect(create()).rejects.toBeInstanceOf(BadRequest)

    const stored = [...jobs.values()]
    expect(stored).toHaveLength(1)
    expect(stored[0].status).toBe('failed')
    expect(stored[0].failureCode).toBe('submit_failed')
  })
})

// ----------------------------------------------------------------------------
// status reconciliation
// ----------------------------------------------------------------------------

describe('getRender', () => {
  test('is scoped to the project that owns the job', async () => {
    const job = await create()

    await expect(
      renderService.getRender(job.id, OTHER_PROJECT_ID),
    ).rejects.toBeInstanceOf(NotFound)
  })

  test('stores the output location when the render completes', async () => {
    const job = await create()
    remoteJobs.set(
      job.id,
      remote({
        jobId: job.id,
        status: 'completed',
        progress: 1,
        outputKey: `renders/${PROJECT_ID}/${job.id}.mp4`,
        sizeInBytes: 2048,
      }),
    )

    const status = await renderService.getRender(job.id, PROJECT_ID)

    expect(status.status).toBe('completed')
    expect(status.progress).toBe(100)
    expect(status.sizeInBytes).toBe(2048)
    expect(status.finishedAt).not.toBeNull()
    expect(jobs.get(job.id)?.outputKey).toBe(
      `renders/${PROJECT_ID}/${job.id}.mp4`,
    )
  })

  test('surfaces a sanitized failure', async () => {
    const job = await create()
    remoteJobs.set(
      job.id,
      remote({
        jobId: job.id,
        status: 'failed',
        error: { code: 'container_error', message: 'Render crashed' },
      }),
    )

    const status = await renderService.getRender(job.id, PROJECT_ID)

    expect(status.status).toBe('failed')
    expect(status.error).toEqual({
      code: 'container_error',
      message: 'Render crashed',
    })
  })

  test('fails a job the render service no longer knows about', async () => {
    const job = await create()
    remoteJobs.delete(job.id)

    const status = await renderService.getRender(job.id, PROJECT_ID)

    expect(status.status).toBe('failed')
    expect(status.error?.code).toBe('render_lost')
  })

  test('does not poll a job that already reached a terminal state', async () => {
    const job = buildJob({
      status: 'completed',
      progress: 100,
      outputKey: 'renders/a.mp4',
    })
    jobs.set(job.id, job)

    const status = await renderService.getRender(job.id, PROJECT_ID)

    expect(status.status).toBe('completed')
    expect(status.progress).toBe(100)
  })
})

// ----------------------------------------------------------------------------
// cancellation and download
// ----------------------------------------------------------------------------

describe('cancelRender', () => {
  test('cancels an in-flight render', async () => {
    const job = await create()

    const cancelled = await renderService.cancelRender(job.id, PROJECT_ID)

    expect(cancelled.status).toBe('cancelled')
    expect(cancelledRemoteRenders).toEqual([job.id])
    expect(jobs.get(job.id)?.finishedAt).not.toBeNull()
  })

  test('refuses to cancel a completed render', async () => {
    const job = buildJob({ status: 'completed', outputKey: 'renders/a.mp4' })
    jobs.set(job.id, job)

    await expect(
      renderService.cancelRender(job.id, PROJECT_ID),
    ).rejects.toBeInstanceOf(Conflict)
  })
})

describe('getRenderDownload', () => {
  test('signs the private output once the render completed', async () => {
    const job = buildJob({
      status: 'completed',
      progress: 100,
      outputKey: `renders/${PROJECT_ID}/out.mp4`,
      outputSizeInBytes: 4096,
    })
    jobs.set(job.id, job)

    const download = await renderService.getRenderDownload(job.id, PROJECT_ID)

    expect(download.url).toContain(`renders/${PROJECT_ID}/out.mp4`)
    expect(download.fileName).toBe('export.mp4')
    expect(download.sizeInBytes).toBe(4096)
  })

  test('refuses to sign an unfinished render', async () => {
    const job = await create()

    await expect(
      renderService.getRenderDownload(job.id, PROJECT_ID),
    ).rejects.toBeInstanceOf(Conflict)
  })
})
