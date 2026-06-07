import api from '@/lib/axios'

// ============================================================================
// Server response types (matching Drizzle row shapes from the backend)
// ============================================================================

export type ServerComposition = {
  id: string
  projectId: string
  fileNodeId: string
  fps: number
  durationInFrames: number
  aspectRatio: string
  width: number
  height: number
  version: number
  createdAt: string
  updatedAt: string
}

export type ServerTrack = {
  id: string
  compositionId: string
  type: string
  position: number
  muted: boolean
  hidden: boolean
  createdAt: string
  updatedAt: string
}

export type ServerClip = {
  id: string
  trackId: string
  compositionId: string
  type: string
  startFrame: number
  endFrame: number
  sourceStartFrame: number
  sourceDurationInFrames: number
  assetId: string | null
  properties: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

type ServerTrackWithClips = ServerTrack & { clips: ServerClip[] }

export type LoadCompositionResponse = {
  composition: ServerComposition
  tracks: ServerTrackWithClips[]
}

export type CreateCompositionInput = {
  fileNodeId: string
  fps?: number
  durationInFrames?: number
  aspectRatio?: string
  width?: number
  height?: number
}

export type UpdateCompositionInput = {
  fps?: number
  durationInFrames?: number
  aspectRatio?: string
  width?: number
  height?: number
}

export type BatchOperation =
  | { op: 'update_composition'; compositionId: string; patch: UpdateCompositionInput }
  | { op: 'add_track'; data: { id?: string; type: string; name: string; position?: number; muted?: boolean; hidden?: boolean } }
  | { op: 'update_track'; trackId: string; patch: { name?: string; position?: number; muted?: boolean; hidden?: boolean } }
  | { op: 'remove_track'; trackId: string }
  | {
      op: 'add_clip'
      data: {
        id?: string
        trackId: string
        type: string
        startFrame: number
        endFrame: number
        sourceStartFrame?: number
        sourceDurationInFrames: number
        assetId?: string | null
        properties: Record<string, unknown>
      }
    }
  | { op: 'update_clip'; clipId: string; patch: { trackId?: string; startFrame?: number; endFrame?: number; sourceStartFrame?: number; sourceDurationInFrames?: number; properties?: Record<string, unknown> } }
  | { op: 'remove_clip'; clipId: string }

// ============================================================================
// API functions
// ============================================================================

export async function loadComposition(
  projectId: string,
  fileNodeId: string,
): Promise<LoadCompositionResponse> {
  const res = await api.get<LoadCompositionResponse>(
    `/video-editor/${projectId}/file-nodes/${fileNodeId}/composition`,
  )
  return res.data
}

export async function createComposition(
  projectId: string,
  input: CreateCompositionInput,
): Promise<ServerComposition> {
  const res = await api.post<ServerComposition>(
    `/video-editor/${projectId}/compositions`,
    input,
  )
  return res.data
}

export async function updateComposition(
  projectId: string,
  compositionId: string,
  input: UpdateCompositionInput,
): Promise<ServerComposition> {
  const res = await api.patch<ServerComposition>(
    `/video-editor/${projectId}/compositions/${compositionId}`,
    input,
  )
  return res.data
}

export async function batchEdit(
  projectId: string,
  compositionId: string,
  operations: BatchOperation[],
): Promise<Array<{ op: string; id: string }>> {
  const res = await api.post<Array<{ op: string; id: string }>>(
    `/video-editor/${projectId}/compositions/${compositionId}/batch`,
    { operations },
  )
  return res.data
}

export async function generateCaption(
  projectId: string,
  trackId: string,
): Promise<{ok: boolean}> {
  const res = await api.post(
    `/video-editor/${projectId}/tracks/${trackId}/captions`,
  )
  return res.data
}

// ============================================================================
// Media upload helper
// ============================================================================

type UploadUrlResponse = {
  url: string
  storageKey: string
  maxSizeInBytes: number
}

type AssetFileContent = {
  type: string
  url: string
  name: string
  metadata: Record<string, unknown> | null
  storageKey: string
}

export type UploadedAsset = {
  fileNodeId: string
  url: string
  name: string
  type: string
}

export async function uploadMediaAsset(
  projectId: string,
  folderId: string,
  file: File,
): Promise<UploadedAsset> {
  const contentType = file.type || 'application/octet-stream'

  const { data: uploadData } = await api.get<UploadUrlResponse>(
    '/media/upload-url',
    { params: { projectId, fileName: file.name, contentType } },
  )

  if (file.size > uploadData.maxSizeInBytes) {
    throw new Error('File exceeds the maximum upload size.')
  }

  const uploadRes = await fetch(uploadData.url, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': contentType },
  })

  if (!uploadRes.ok) {
    throw new Error('Failed to upload file to storage.')
  }

  const { data: fileNode } = await api.post<{ id: string; name: string }>(
    '/media/upload-success',
    { projectId, folderId, storageKey: uploadData.storageKey },
  )

  const { data: content } = await api.get<AssetFileContent>(
    `/projects/${projectId}/files/${fileNode.id}`,
  )

  return {
    fileNodeId: fileNode.id,
    url: content.url,
    name: content.name,
    type: content.type,
  }
}
