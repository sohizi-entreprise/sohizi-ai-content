import { HttpError, json } from '../http'
import { requireServiceToken } from './auth'
import {
  RENDER_LIMITS,
  createRenderRequestSchema,
  renderProgressSchema,
} from './contracts'
import { renderKeys } from './keys'
import { assertMediaHostsAllowed, parseAllowedHosts } from './media-hosts'
import type { WorkerEnv } from '../env'
import type {
  CreateRenderRequest,
  RenderJobState,
  RenderJobStatus,
  RenderWorkflowParams,
} from './contracts'
import type { RenderWorkflowOutput } from './workflow'

const RENDER_PREFIX = '/v1/renders'

export function isRenderRoute(pathname: string): boolean {
  return pathname === RENDER_PREFIX || pathname.startsWith(`${RENDER_PREFIX}/`)
}

export async function handleRenderRoute(
  request: Request,
  env: WorkerEnv,
): Promise<Response> {
  requireServiceToken(request, env)

  const url = new URL(request.url)
  const jobId = url.pathname.slice(RENDER_PREFIX.length).replace(/^\//, '')

  if (jobId === '') {
    if (request.method !== 'POST') {
      throw new HttpError('method_not_allowed', 'Use POST to create a render')
    }
    return createRender(request, env)
  }

  if (request.method === 'GET') return getRender(jobId, url, env)
  if (request.method === 'DELETE') return cancelRender(jobId, url, env)

  throw new HttpError('method_not_allowed', 'Use GET or DELETE on a render')
}

async function readCreateRequest(request: Request): Promise<CreateRenderRequest> {
  const declaredLength = Number(request.headers.get('Content-Length') ?? '0')
  if (declaredLength > RENDER_LIMITS.maxPayloadBytes) {
    throw new HttpError('payload_too_large', 'Render snapshot is too large')
  }

  const raw = await request.text()
  if (raw.length > RENDER_LIMITS.maxPayloadBytes) {
    throw new HttpError('payload_too_large', 'Render snapshot is too large')
  }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(raw)
  } catch {
    throw new HttpError('bad_request', 'Body must be JSON')
  }

  const result = createRenderRequestSchema.safeParse(parsedJson)
  if (!result.success) {
    throw new HttpError('bad_request', 'Invalid render snapshot', {
      issues: result.error.issues.slice(0, 20).map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    })
  }
  return result.data
}

async function createRender(request: Request, env: WorkerEnv): Promise<Response> {
  const body = await readCreateRequest(request)
  assertMediaHostsAllowed(
    body.composition,
    parseAllowedHosts(env.RENDER_ALLOWED_MEDIA_HOSTS),
  )

  const keys = renderKeys(body.projectId, body.jobId)

  const existing = await getWorkflowState(body.jobId, body.projectId, env)
  if (existing) {
    // Retrying a submission must not start a second render.
    return json({ job: existing, idempotent: true }, { status: 200 })
  }

  await env.R2_BUCKET.put(
    keys.input,
    JSON.stringify({
      jobId: body.jobId,
      projectId: body.projectId,
      compositionId: body.compositionId,
      composition: body.composition,
      createdAt: new Date().toISOString(),
    }),
    { httpMetadata: { contentType: 'application/json' } },
  )

  const params: RenderWorkflowParams = {
    jobId: body.jobId,
    projectId: body.projectId,
    compositionId: body.compositionId,
    fileName: body.fileName,
    inputKey: keys.input,
    outputKey: keys.output,
    progressKey: keys.progress,
    frameCount: body.composition.durationInFrames,
  }

  try {
    await env.RENDER_WORKFLOW.create({ id: body.jobId, params })
  } catch (error) {
    // `create` throws when the id is taken; treat it as the idempotent path.
    const state = await getWorkflowState(body.jobId, body.projectId, env)
    if (state) return json({ job: state, idempotent: true }, { status: 200 })
    await env.R2_BUCKET.delete(keys.input)
    throw error
  }

  const job: RenderJobState = {
    jobId: body.jobId,
    status: 'queued',
    progress: 0,
    renderedFrames: 0,
    frameCount: params.frameCount,
  }
  return json({ job, idempotent: false }, { status: 202 })
}

async function getRender(
  jobId: string,
  url: URL,
  env: WorkerEnv,
): Promise<Response> {
  const projectId = requireProjectId(url)
  const state = await getWorkflowState(jobId, projectId, env)
  if (!state) throw new HttpError('not_found', 'Render job not found')
  return json({ job: state })
}

async function cancelRender(
  jobId: string,
  url: URL,
  env: WorkerEnv,
): Promise<Response> {
  const projectId = requireProjectId(url)
  const keys = renderKeys(projectId, jobId)

  let instance: WorkflowInstance
  try {
    instance = await env.RENDER_WORKFLOW.get(jobId)
  } catch {
    throw new HttpError('not_found', 'Render job not found')
  }

  const status = await instance.status()
  if (status.status === 'complete') {
    throw new HttpError('conflict', 'Render already completed')
  }

  if (
    status.status !== 'errored' &&
    status.status !== 'terminated' &&
    status.status !== 'unknown'
  ) {
    await instance.terminate().catch((error) => {
      console.error('[render] terminate failed:', error)
    })
  }

  await env.R2_BUCKET.delete([keys.input, keys.progress])

  const job: RenderJobState = {
    jobId,
    status: 'cancelled',
    progress: 0,
    renderedFrames: 0,
    frameCount: 0,
  }
  return json({ job })
}

function requireProjectId(url: URL): string {
  const projectId = url.searchParams.get('projectId')
  if (!projectId) {
    throw new HttpError('bad_request', 'Missing "projectId" query parameter')
  }
  return projectId
}

const STATUS_MAP: Record<string, RenderJobStatus> = {
  queued: 'queued',
  running: 'rendering',
  waiting: 'rendering',
  waitingForPause: 'rendering',
  paused: 'rendering',
  complete: 'completed',
  errored: 'failed',
  terminated: 'cancelled',
  unknown: 'failed',
}

async function getWorkflowState(
  jobId: string,
  projectId: string,
  env: WorkerEnv,
): Promise<RenderJobState | null> {
  let instance: WorkflowInstance
  try {
    instance = await env.RENDER_WORKFLOW.get(jobId)
  } catch {
    return null
  }

  const status = await instance.status()
  const mapped = STATUS_MAP[status.status] ?? 'failed'

  if (mapped === 'completed') {
    const output = status.output as RenderWorkflowOutput | undefined
    return {
      jobId,
      status: 'completed',
      progress: 1,
      renderedFrames: output?.frameCount ?? 0,
      frameCount: output?.frameCount ?? 0,
      outputKey: output?.outputKey,
      sizeInBytes: output?.sizeInBytes,
    }
  }

  if (mapped === 'failed' || mapped === 'cancelled') {
    return {
      jobId,
      status: mapped,
      progress: 0,
      renderedFrames: 0,
      frameCount: 0,
      ...(status.error
        ? { error: { code: 'render_failed', message: status.error.message } }
        : {}),
    }
  }

  const progress = await readProgress(jobId, projectId, env)
  return {
    jobId,
    status: mapped,
    progress: progress?.progress ?? 0,
    renderedFrames: progress?.renderedFrames ?? 0,
    frameCount: progress?.frameCount ?? 0,
  }
}

async function readProgress(
  jobId: string,
  projectId: string,
  env: WorkerEnv,
) {
  const object = await env.R2_BUCKET.get(renderKeys(projectId, jobId).progress)
  if (!object) return null
  const parsed = renderProgressSchema.safeParse(await object.json())
  return parsed.success ? parsed.data : null
}
