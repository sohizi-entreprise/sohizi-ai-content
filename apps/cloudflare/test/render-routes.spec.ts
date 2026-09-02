import { describe, expect, it } from 'vitest'
import worker from '../src/index'
import { RENDER_CONTRACT_VERSION } from '../src/render/contracts'
import { createTestEnv } from './fakes'

const JOB_ID = 'job-1234'
const PROJECT_ID = '11111111-1111-4111-8111-111111111111'
const COMPOSITION_ID = '22222222-2222-4222-8222-222222222222'

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    contractVersion: RENDER_CONTRACT_VERSION,
    jobId: JOB_ID,
    projectId: PROJECT_ID,
    compositionId: COMPOSITION_ID,
    fileName: 'my export.mp4',
    composition: {
      fps: 30,
      width: 1920,
      height: 1080,
      durationInFrames: 90,
      tracks: [
        {
          id: 'track-1',
          type: 'video',
          name: 'Video 1',
          muted: false,
          hidden: false,
          clips: [
            {
              id: 'clip-1',
              trackId: 'track-1',
              type: 'video',
              startFrame: 0,
              endFrame: 90,
              sourceStartFrame: 0,
              sourceDurationInFrames: 90,
              url: 'https://cdn.sohizi.com/media/clip.mp4',
              fileName: 'clip.mp4',
              volume: 1,
              opacity: 1,
              speed: 1,
              borderRadius: 0,
              xRatio: 0.5,
              yRatio: 0.5,
              widthRatio: 1,
              heightRatio: 1,
            },
          ],
        },
      ],
    },
    ...overrides,
  }
}

function createRequest(body: unknown, token = 'test-token'): Request {
  return new Request('https://worker.test/v1/renders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
}

describe('render routes: authentication', () => {
  it('rejects a request without a token', async () => {
    const { env } = createTestEnv()
    const response = await worker.fetch(createRequest(snapshot(), ''), env)
    expect(response.status).toBe(401)
  })

  it('rejects a wrong token', async () => {
    const { env } = createTestEnv()
    const response = await worker.fetch(createRequest(snapshot(), 'nope'), env)
    expect(response.status).toBe(401)
  })

  it('fails closed when no token is configured', async () => {
    const { env } = createTestEnv({ RENDER_SERVICE_TOKEN: undefined })
    const response = await worker.fetch(createRequest(snapshot()), env)
    expect(response.status).toBe(401)
  })
})

describe('render routes: validation', () => {
  it('rejects an unknown contract version', async () => {
    const { env } = createTestEnv()
    const response = await worker.fetch(
      createRequest(snapshot({ contractVersion: 99 })),
      env,
    )
    expect(response.status).toBe(400)
  })

  it('rejects a composition outside the supported limits', async () => {
    const { env } = createTestEnv()
    const body = snapshot()
    ;(body.composition as { width: number }).width = 10_000
    const response = await worker.fetch(createRequest(body), env)
    expect(response.status).toBe(400)

    const payload = (await response.json()) as {
      error: { code: string; details: { issues: Array<{ path: string }> } }
    }
    expect(payload.error.code).toBe('bad_request')
    expect(payload.error.details.issues[0].path).toContain('width')
  })

  it('rejects media hosted outside the allowlist', async () => {
    const { env } = createTestEnv()
    const body = snapshot()
    const clip = (
      body.composition as { tracks: Array<{ clips: Array<{ url: string }> }> }
    ).tracks[0].clips[0]
    clip.url = 'https://evil.example.com/clip.mp4'

    const response = await worker.fetch(createRequest(body), env)
    expect(response.status).toBe(400)
    const payload = (await response.json()) as {
      error: { details: { hosts: Array<string> } }
    }
    expect(payload.error.details.hosts).toEqual(['evil.example.com'])
  })

  it('rejects a filename that could escape the R2 prefix', async () => {
    const { env } = createTestEnv()
    const response = await worker.fetch(
      createRequest(snapshot({ fileName: '../../etc/passwd' })),
      env,
    )
    expect(response.status).toBe(400)
  })

  it('rejects non-JSON bodies', async () => {
    const { env } = createTestEnv()
    const response = await worker.fetch(
      new Request('https://worker.test/v1/renders', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-token' },
        body: 'not json',
      }),
      env,
    )
    expect(response.status).toBe(400)
  })
})

describe('render routes: job lifecycle', () => {
  it('creates a workflow instance and stores the snapshot', async () => {
    const { bucket, workflow, env } = createTestEnv()

    const response = await worker.fetch(createRequest(snapshot()), env)
    expect(response.status).toBe(202)

    const payload = (await response.json()) as {
      job: { jobId: string; status: string; frameCount: number }
      idempotent: boolean
    }
    expect(payload.job).toMatchObject({
      jobId: JOB_ID,
      status: 'queued',
      frameCount: 90,
    })
    expect(payload.idempotent).toBe(false)

    expect(workflow.instances.has(JOB_ID)).toBe(true)
    expect(workflow.createdParams.get(JOB_ID)).toMatchObject({
      outputKey: `renders/${PROJECT_ID}/${JOB_ID}.mp4`,
      inputKey: `renders/${PROJECT_ID}/${JOB_ID}.input.json`,
      frameCount: 90,
    })
    expect(
      bucket.objects.has(`renders/${PROJECT_ID}/${JOB_ID}.input.json`),
    ).toBe(true)
  })

  it('is idempotent for a repeated submission', async () => {
    const { workflow, env } = createTestEnv()

    await worker.fetch(createRequest(snapshot()), env)
    const second = await worker.fetch(createRequest(snapshot()), env)

    expect(second.status).toBe(200)
    const payload = (await second.json()) as { idempotent: boolean }
    expect(payload.idempotent).toBe(true)
    expect(workflow.instances.size).toBe(1)
  })

  it('reports rendering progress published by the workflow', async () => {
    const { bucket, workflow, env } = createTestEnv()
    await worker.fetch(createRequest(snapshot()), env)
    workflow.setStatus(JOB_ID, { status: 'running' })
    await bucket.put(
      `renders/${PROJECT_ID}/${JOB_ID}.progress.json`,
      JSON.stringify({
        progress: 0.42,
        renderedFrames: 38,
        frameCount: 90,
        updatedAt: new Date().toISOString(),
      }),
    )

    const response = await worker.fetch(
      new Request(
        `https://worker.test/v1/renders/${JOB_ID}?projectId=${PROJECT_ID}`,
        { headers: { Authorization: 'Bearer test-token' } },
      ),
      env,
    )

    expect(response.status).toBe(200)
    const payload = (await response.json()) as {
      job: { status: string; progress: number; renderedFrames: number }
    }
    expect(payload.job).toMatchObject({
      status: 'rendering',
      progress: 0.42,
      renderedFrames: 38,
    })
  })

  it('exposes the output key once the workflow completes', async () => {
    const { workflow, env } = createTestEnv()
    await worker.fetch(createRequest(snapshot()), env)
    workflow.setStatus(JOB_ID, {
      status: 'complete',
      output: {
        outputKey: `renders/${PROJECT_ID}/${JOB_ID}.mp4`,
        sizeInBytes: 2048,
        frameCount: 90,
        finishedAt: new Date().toISOString(),
      },
    })

    const response = await worker.fetch(
      new Request(
        `https://worker.test/v1/renders/${JOB_ID}?projectId=${PROJECT_ID}`,
        { headers: { Authorization: 'Bearer test-token' } },
      ),
      env,
    )

    const payload = (await response.json()) as {
      job: {
        status: string
        outputKey: string
        sizeInBytes: number
        progress: number
      }
    }
    expect(payload.job).toMatchObject({
      status: 'completed',
      outputKey: `renders/${PROJECT_ID}/${JOB_ID}.mp4`,
      sizeInBytes: 2048,
      progress: 1,
    })
  })

  it('surfaces a workflow failure without leaking internals', async () => {
    const { workflow, env } = createTestEnv()
    await worker.fetch(createRequest(snapshot()), env)
    workflow.setStatus(JOB_ID, {
      status: 'errored',
      error: { name: 'Error', message: 'Chromium crashed' },
    })

    const response = await worker.fetch(
      new Request(
        `https://worker.test/v1/renders/${JOB_ID}?projectId=${PROJECT_ID}`,
        { headers: { Authorization: 'Bearer test-token' } },
      ),
      env,
    )

    const payload = (await response.json()) as {
      job: { status: string; error: { code: string; message: string } }
    }
    expect(payload.job.status).toBe('failed')
    expect(payload.job.error.code).toBe('render_failed')
  })

  it('404s for an unknown job', async () => {
    const { env } = createTestEnv()
    const response = await worker.fetch(
      new Request(
        `https://worker.test/v1/renders/missing?projectId=${PROJECT_ID}`,
        { headers: { Authorization: 'Bearer test-token' } },
      ),
      env,
    )
    expect(response.status).toBe(404)
  })

  it('requires the project id on status reads', async () => {
    const { env } = createTestEnv()
    const response = await worker.fetch(
      new Request(`https://worker.test/v1/renders/${JOB_ID}`, {
        headers: { Authorization: 'Bearer test-token' },
      }),
      env,
    )
    expect(response.status).toBe(400)
  })

  it('terminates the workflow and clears temporary objects on cancel', async () => {
    const { bucket, workflow, env } = createTestEnv()
    await worker.fetch(createRequest(snapshot()), env)
    workflow.setStatus(JOB_ID, { status: 'running' })

    const response = await worker.fetch(
      new Request(
        `https://worker.test/v1/renders/${JOB_ID}?projectId=${PROJECT_ID}`,
        { method: 'DELETE', headers: { Authorization: 'Bearer test-token' } },
      ),
      env,
    )

    expect(response.status).toBe(200)
    expect(workflow.terminated).toEqual([JOB_ID])
    expect(
      bucket.objects.has(`renders/${PROJECT_ID}/${JOB_ID}.input.json`),
    ).toBe(false)
  })

  it('refuses to cancel a finished render', async () => {
    const { workflow, env } = createTestEnv()
    await worker.fetch(createRequest(snapshot()), env)
    workflow.setStatus(JOB_ID, { status: 'complete', output: {} })

    const response = await worker.fetch(
      new Request(
        `https://worker.test/v1/renders/${JOB_ID}?projectId=${PROJECT_ID}`,
        { method: 'DELETE', headers: { Authorization: 'Bearer test-token' } },
      ),
      env,
    )
    expect(response.status).toBe(409)
  })

  it('rejects unsupported methods on the collection', async () => {
    const { env } = createTestEnv()
    const response = await worker.fetch(
      new Request('https://worker.test/v1/renders', {
        method: 'PUT',
        headers: { Authorization: 'Bearer test-token' },
      }),
      env,
    )
    expect(response.status).toBe(405)
  })
})
