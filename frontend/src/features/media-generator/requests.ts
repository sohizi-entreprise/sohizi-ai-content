import api from '@/lib/axios'
import { createParser, type EventSourceMessage } from 'eventsource-parser'
import type { MediaType } from './types'
import { FilePart, ImagePart, Message, MsgTextPart } from '../chat/types'

export type CursorPaginationOptions = {
  cursor?: string
  limit?: number
}

export type CursorPaginationResult<T> = {
  data: T[]
  nextCursor: string | null
  hasMore: boolean
}

export type AssetRequest = {
  userPrompt: {
    role: 'user'
    content: (MsgTextPart | ImagePart | FilePart)[]
  }
  settings?: Record<string, unknown>
}

export type MediaAsset = {
  id: string
  projectId: string
  name: string
  type: MediaType
  url: string
  storageKey: string
  source: 'user-uploaded' | 'ai-generated'
  generationRequestId: string | null
  fileNodeId: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export type MediaGenerationRun = {
  id: string
  projectId: string
  status: 'pending' | 'running' | 'finished' | 'error'
  assets: MediaAsset[]
  messages: Array<Message>
  metadata: { settings: Record<string, unknown> } | null
  error: string | null
  createdAt: string
  updatedAt: string
}

export type ListAssetsOptions = CursorPaginationOptions & {
  type?: MediaType
}

export type CancelGenerationResponse = {
  ok: boolean
  error: string | null
}

export type MediaStreamEvent = {
  runId: string
  event: string
  chunk?: unknown
  [key: string]: unknown
}

export const listAssetsRequests = async (
  projectId: string,
  options?: ListAssetsOptions,
): Promise<CursorPaginationResult<MediaGenerationRun>> => {
  const response = await api.get(`/media/${projectId}/assets`, { params: options })
  return response.data
}

export const listAiGeneratedAssets = async (
  projectId: string,
  options?: ListAssetsOptions,
): Promise<CursorPaginationResult<MediaAsset>> => {
  const response = await api.get(`/media/${projectId}/ai-assets`, { params: options })
  return response.data
}

export const startGeneration = async (
  projectId: string,
  data: AssetRequest,
): Promise<MediaGenerationRun> => {
  const response = await api.post(`/media/${projectId}/assets`, data)
  return response.data
}

export const cancelGeneration = async (
  projectId: string,
  requestId: string,
): Promise<CancelGenerationResponse> => {
  const response = await api.delete(`/media/${projectId}/requests/${requestId}`)
  return response.data
}

export const deleteAsset = async (
  projectId: string,
  assetId: string,
): Promise<{ ok: boolean }> => {
  const response = await api.delete(`/media/${projectId}/assets/${assetId}`)
  return response.data
}

export const moveAssetToFolder = async (
  projectId: string,
  assetId: string,
  folderId: string,
): Promise<void> => {
  await api.post(`/media/${projectId}/assets/${assetId}/move-to-folder`, { folderId })
}

export const bulkMoveAssetsToFolder = async (
  projectId: string,
  assetIds: string[],
  folderId: string,
): Promise<void> => {
  await api.post(`/media/${projectId}/assets/bulk/move-to-folder`, {
    assetIds,
    folderId,
  })
}

export const bulkDeleteAssets = async (
  projectId: string,
  assetIds: string[],
): Promise<{ ok: boolean; count: number }> => {
  const response = await api.post(`/media/${projectId}/assets/bulk/delete`, {
    assetIds,
  })
  return response.data
}

export const downloadAssetsZip = async (
  projectId: string,
  assetIds: string[],
): Promise<Blob> => {
  const response = await api.post(
    `/media/${projectId}/assets/bulk/download-zip`,
    { assetIds },
    { responseType: 'blob' },
  )
  return response.data
}

export const getAssetDownloadUrl = async (
  projectId: string,
  assetId: string,
): Promise<{ url: string }> => {
  const response = await api.get(
    `/media/${projectId}/assets/${assetId}/download-url`,
  )
  return response.data
}

export async function* getStream(
  projectId: string,
  requestId: string,
  options?: { signal?: AbortSignal },
): AsyncGenerator<MediaStreamEvent, void, unknown> {
  const response = await fetch(
    `${api.defaults.baseURL ?? ''}/media/${projectId}/requests/${requestId}`,
    {
      method: 'GET',
      credentials: 'include',
      signal: options?.signal,
    },
  )

  if (!response.ok) {
    throw new Error(`Failed to stream media generation: ${response.status}`)
  }

  if (!response.body) {
    throw new Error('No response body')
  }

  for await (const event of parseSseStream(response.body)) {
    if (!event.data) continue
    yield JSON.parse(event.data) as MediaStreamEvent
  }
}

async function* parseSseStream(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  const events: EventSourceMessage[] = []
  const parser = createParser({
    onEvent: (event) => {
      events.push(event)
    },
  })

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      parser.feed(decoder.decode(value, { stream: true }))

      while (events.length > 0) {
        yield events.shift()!
      }
    }

    const remaining = decoder.decode()
    if (remaining) {
      parser.feed(remaining)
    }

    parser.reset({ consume: true })

    while (events.length > 0) {
      yield events.shift()!
    }
  } finally {
    reader.releaseLock()
  }
}