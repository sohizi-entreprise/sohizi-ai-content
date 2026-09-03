import { BadRequest, InternalServerError } from "../error"
import {
  RENDER_CONTRACT_VERSION,
  type RenderComposition,
} from "./render-schema"

/**
 * Client for the Cloudflare render service. The service token never leaves the
 * server, so the editor can only reach renders through the authenticated API.
 */

const REQUEST_TIMEOUT_MS = 15_000

export type RemoteRenderStatus =
  "queued" | "rendering" | "completed" | "failed" | "cancelled"

export type RemoteRenderJob = {
  jobId: string
  status: RemoteRenderStatus
  progress: number
  renderedFrames: number
  frameCount: number
  outputKey?: string
  sizeInBytes?: number
  error?: { code: string; message: string }
}

type RenderServiceConfig = {
  baseUrl: string
  token: string
}

function getConfig(): RenderServiceConfig {
  const baseUrl = process.env.CLOUDFLARE_WORKER_URL
  const token = process.env.RENDER_SERVICE_TOKEN

  if (!baseUrl || !token) {
    console.error("CLOUDFLARE_WORKER_URL or RENDER_SERVICE_TOKEN is not set")
    throw new InternalServerError("Rendering is not configured")
  }

  return { baseUrl: baseUrl.replace(/\/$/, ""), token }
}

export function parseAllowedMediaHosts(): string[] {
  return (process.env.RENDER_ALLOWED_MEDIA_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter((host) => host.length > 0)
}

type ServiceError = {
  code: string
  message: string
  details?: unknown
}

async function readError(response: Response): Promise<ServiceError> {
  try {
    const body = (await response.json()) as { error?: ServiceError }
    if (body.error?.code && body.error.message) return body.error
  } catch {
    // fall through to a generic error below
  }
  return {
    code: "render_service_error",
    message: `Render service returned ${response.status}`,
  }
}

async function call(
  path: string,
  init: { method: string; body?: string },
): Promise<Response> {
  const { baseUrl, token } = getConfig()

  try {
    return await fetch(`${baseUrl}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    console.error("[render] render service unreachable:", error)
    throw new InternalServerError("Render service is unavailable")
  }
}

function asJob(payload: unknown): RemoteRenderJob {
  const job = (payload as { job?: RemoteRenderJob } | null)?.job
  if (!job || typeof job.jobId !== "string") {
    throw new InternalServerError(
      "Render service returned an unexpected payload",
    )
  }
  return job
}

export async function createRemoteRender(input: {
  jobId: string
  projectId: string
  compositionId: string
  fileName: string
  composition: RenderComposition
}): Promise<RemoteRenderJob> {
  const response = await call("/v1/renders", {
    method: "POST",
    body: JSON.stringify({
      contractVersion: RENDER_CONTRACT_VERSION,
      jobId: input.jobId,
      projectId: input.projectId,
      compositionId: input.compositionId,
      fileName: input.fileName,
      composition: input.composition,
    }),
  })

  if (response.ok) return asJob(await response.json())

  const error = await readError(response)
  if (response.status === 400 || response.status === 413) {
    throw new BadRequest(
      `This composition cannot be rendered: ${error.message}`,
    )
  }
  console.error("[render] create failed:", response.status, error)
  throw new InternalServerError("Could not start the render")
}

export async function getRemoteRender(
  jobId: string,
  projectId: string,
): Promise<RemoteRenderJob | null> {
  const query = new URLSearchParams({ projectId })
  const response = await call(`/v1/renders/${jobId}?${query.toString()}`, {
    method: "GET",
  })

  if (response.ok) return asJob(await response.json())
  if (response.status === 404) return null

  const error = await readError(response)
  console.error("[render] status failed:", response.status, error)
  throw new InternalServerError("Could not read the render status")
}

export async function cancelRemoteRender(
  jobId: string,
  projectId: string,
): Promise<void> {
  const query = new URLSearchParams({ projectId })
  const response = await call(`/v1/renders/${jobId}?${query.toString()}`, {
    method: "DELETE",
  })

  // A finished or already-forgotten job needs no cancellation upstream.
  if (response.ok || response.status === 404 || response.status === 409) return

  const error = await readError(response)
  console.error("[render] cancel failed:", response.status, error)
  throw new InternalServerError("Could not cancel the render")
}
