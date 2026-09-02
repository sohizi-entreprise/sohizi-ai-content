import type {
  CursorPaginationOptions,
  CursorPaginationResult,
} from "@/lib/pagination"
import type { ModelParameterBinding } from "@/features/admin/types"
import type {
  AiGeneratedMediaRequest,
  MediaAsset,
  MediaRunMode,
  MediaType,
} from "./types"
import api from "@/lib/axios"

export type {
  AiGeneratedMediaRequest,
  AiGeneratedRequestAsset,
  MediaAsset,
  MediaAssetGenerationRequest,
} from "./types"
export type { CursorPaginationOptions, CursorPaginationResult }

export type AssetRequest = {
  model: string
  prompt: string
  settings: Record<string, unknown>
  context: Record<string, unknown>
  runMode: MediaRunMode
}

export type GenerationRequestAsset = {
  assetId: string
  type: MediaType
  url: string
  name: string
}

export type MediaGenerationRun = {
  id: string
  projectId: string
  userId: string
  status: "pending" | "processing" | "completed" | "failed" | "aborted"
  type: "media-generation"
  request: AssetRequest
  history: Array<unknown> | null
  assets: Array<GenerationRequestAsset>
  error: string | null
  createdAt: string
  updatedAt: string
}

export type ListAssetsOptions = CursorPaginationOptions & {
  type?: MediaType
}

export type GoogleVoiceDescription = {
  name: string
  gender: "female" | "male"
  description: string
  previewUrl: string
}

export const listGoogleVoices = async (): Promise<
  Array<GoogleVoiceDescription>
> => {
  const response = await api.get("/models/voices")
  return response.data
}

export const listCatalogModelParameters = async (
  modelId: string,
): Promise<Array<ModelParameterBinding>> => {
  const response = await api.get(
    `/models/${encodeURIComponent(modelId)}/parameters`,
  )
  return response.data
}

export const listAiGeneratedAssets = async (
  projectId: string,
  options?: ListAssetsOptions,
): Promise<CursorPaginationResult<AiGeneratedMediaRequest>> => {
  const response = await api.get(`/media/${projectId}/ai-assets`, {
    params: options,
  })
  return response.data
}

export type UploadedAsset = {
  id: string
  projectId: string
  name: string
  type: MediaType
  url: string
  storageKey: string
  source: "user-uploaded"
  fileNodeId: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export const listUploadedAssets = async (
  projectId: string,
  options?: ListAssetsOptions,
): Promise<CursorPaginationResult<UploadedAsset>> => {
  const response = await api.get(`/media/${projectId}/uploaded-assets`, {
    params: options,
  })
  return response.data
}

export const startGeneration = async (
  projectId: string,
  data: AssetRequest,
): Promise<MediaGenerationRun> => {
  const response = await api.post(`/media/${projectId}/assets`, data)
  return response.data
}

export const deleteAsset = async (
  projectId: string,
  assetId: string,
): Promise<{ ok: boolean }> => {
  const response = await api.delete(`/media/${projectId}/assets/${assetId}`)
  return response.data
}

export const deleteGenerationRequest = async (
  projectId: string,
  requestId: string,
): Promise<{ ok: boolean }> => {
  const response = await api.delete(
    `/media/${projectId}/ai-requests/${requestId}`,
  )
  return response.data
}

export const moveAssetToFolder = async (
  projectId: string,
  assetId: string,
  folderId: string,
): Promise<void> => {
  await api.post(`/media/${projectId}/assets/${assetId}/move-to-folder`, {
    folderId,
  })
}

export const updateHtmlAssetValues = async (
  projectId: string,
  assetId: string,
  values: Record<string, string | number | boolean>,
): Promise<MediaAsset> => {
  const response = await api.patch(
    `/media/${projectId}/assets/${assetId}/html-values`,
    {
      values,
    },
  )
  return response.data
}

export const bulkMoveAssetsToFolder = async (
  projectId: string,
  assetIds: Array<string>,
  folderId: string,
): Promise<void> => {
  await api.post(`/media/${projectId}/assets/bulk/move-to-folder`, {
    assetIds,
    folderId,
  })
}

export const bulkDeleteAssets = async (
  projectId: string,
  assetIds: Array<string>,
): Promise<{ ok: boolean; count: number }> => {
  const response = await api.post(`/media/${projectId}/assets/bulk/delete`, {
    assetIds,
  })
  return response.data
}

export const downloadAssetsZip = async (
  projectId: string,
  assetIds: Array<string>,
): Promise<Blob> => {
  const response = await api.post(
    `/media/${projectId}/assets/bulk/download-zip`,
    { assetIds },
    { responseType: "blob" },
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
