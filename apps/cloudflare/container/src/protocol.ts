/**
 * HTTP contract between the Worker's Workflow and this container.
 * Mirrors `cloudflare/src/render/contracts.ts`.
 */

export type RenderTrack = {
  id: string
  type: string
  name: string
  muted: boolean
  hidden: boolean
  clips: Array<Record<string, unknown>>
}

export type RenderComposition = {
  fps: number
  width: number
  height: number
  durationInFrames: number
  tracks: Array<RenderTrack>
}

export type RenderInputDocument = {
  jobId: string
  projectId: string
  compositionId: string
  composition: RenderComposition
  createdAt?: string
}

export type RenderState = "running" | "completed" | "failed"

export type RenderStatusResponse = {
  jobId: string
  state: RenderState
  progress: number
  renderedFrames: number
  encodedFrames: number
  sizeInBytes?: number
  error?: { code: string; message: string; retryable?: boolean }
}

export function isRenderInputDocument(
  value: unknown,
): value is RenderInputDocument {
  if (typeof value !== "object" || value === null) return false
  const doc = value as Partial<RenderInputDocument>
  if (typeof doc.jobId !== "string" || doc.jobId.length === 0) return false
  const composition = doc.composition
  if (typeof composition !== "object" || composition === null) return false
  const { fps, width, height, durationInFrames, tracks } = composition
  return (
    Number.isFinite(fps) &&
    fps > 0 &&
    Number.isFinite(width) &&
    width > 0 &&
    Number.isFinite(height) &&
    height > 0 &&
    Number.isFinite(durationInFrames) &&
    durationInFrames > 0 &&
    Array.isArray(tracks)
  )
}
