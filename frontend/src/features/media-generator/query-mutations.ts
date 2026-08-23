import { mutationOptions, infiniteQueryOptions, keepPreviousData, queryOptions, type InfiniteData, useQueryClient } from "@tanstack/react-query";
import * as requests from './requests';
import { AiGeneratedMediaRequest, AiGeneratedRequestAsset, MediaAsset } from "./requests";
import { useCallback } from "react";

type AssetRequestsInfiniteData = InfiniteData<
  requests.CursorPaginationResult<requests.MediaGenerationRun>,
  string | undefined
>

type AiGeneratedAssetsInfiniteData = InfiniteData<
  requests.CursorPaginationResult<AiGeneratedMediaRequest>,
  string | undefined
>

export const mediaGeneratorKeys = {
  assetsRequests: (projectId: string, options?: requests.ListAssetsOptions) => ['media', projectId, 'assets', options],
  aiGeneratedAssets: (projectId: string, options?: requests.ListAssetsOptions) => ['media', projectId, 'ai-assets', options],
  uploadedAssets: (projectId: string, options?: requests.ListAssetsOptions) => ['media', projectId, 'uploaded-assets', options],
  googleVoices: ['media', 'google-voices'] as const,
  modelParameters: (modelId: string) => ['media', 'models', modelId, 'parameters'] as const,
}

export const listGoogleVoicesQueryOptions = queryOptions({
  queryKey: mediaGeneratorKeys.googleVoices,
  queryFn: () => requests.listGoogleVoices(),
  staleTime: Infinity,
})

export const listCatalogModelParametersQueryOptions = (modelId: string | null) =>
  queryOptions({
    queryKey: mediaGeneratorKeys.modelParameters(modelId ?? ''),
    queryFn: () => requests.listCatalogModelParameters(modelId!),
    enabled: Boolean(modelId),
  })

export const listAssetsRequestsQueryOptions = (projectId: string, options?: requests.ListAssetsOptions) =>
  infiniteQueryOptions({
    queryKey: ['media', projectId, 'assets', options],
    queryFn: ({ pageParam }) => requests.listAssetsRequests(projectId, { ...options, cursor: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    placeholderData: keepPreviousData,
    // Backend returns each page oldest→newest; page[0] is the newest batch.
    // Reverse pages so older batches render above newer ones (chat order).
    select: (data) => [...data.pages].reverse().flatMap((page) => page.data),
  })

export const listAiGeneratedAssetsQueryOptions = (projectId: string, options?: requests.ListAssetsOptions) =>
  infiniteQueryOptions({
    queryKey: ['media', projectId, 'ai-assets', options],
    queryFn: ({ pageParam }) => requests.listAiGeneratedAssets(projectId, { ...options, cursor: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    placeholderData: keepPreviousData,
    select: (data) => data.pages.flatMap(page => page.data),
})

export const listUploadedAssetsQueryOptions = (projectId: string, options?: requests.ListAssetsOptions) =>
  infiniteQueryOptions({
    queryKey: mediaGeneratorKeys.uploadedAssets(projectId, options),
    queryFn: ({ pageParam }) => requests.listUploadedAssets(projectId, { ...options, cursor: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    placeholderData: keepPreviousData,
    select: (data) => data.pages.flatMap((page) => page.data),
  })

export const startGenerationMutationOptions = (projectId: string) =>
  mutationOptions({
    mutationFn: (data: requests.AssetRequest) => requests.startGeneration(projectId, data),
    onSuccess: (data, _variables, _onMutateResult, context) => {
      context.client.setQueriesData<AssetRequestsInfiniteData>(
        { queryKey: mediaGeneratorKeys.assetsRequests(projectId) },
        (old) => appendAssetRequest(old, data),
      )
      context.client.setQueriesData<AiGeneratedAssetsInfiniteData>(
        { queryKey: ['media', projectId, 'ai-assets'] },
        (old) => prependAiGeneratedRequest(old, toAiGeneratedMediaRequest(data)),
      )
    },
   
})


export const cancelGenerationMutationOptions = (projectId: string, requestId: string) =>
  mutationOptions({
    mutationFn: () => requests.cancelGeneration(projectId, requestId),
    meta: {
      invalidateQueries: [mediaGeneratorKeys.assetsRequests(projectId), ['media', projectId, 'ai-assets']],
    },
})

export const deleteAssetMutationOptions = (projectId: string, assetId: string) =>
  mutationOptions({
    mutationFn: () => requests.deleteAsset(projectId, assetId),
    meta: {
      invalidateQueries: [['media', projectId, 'ai-assets']],
    },
  })

export const deleteGenerationRequestMutationOptions = (projectId: string, requestId: string) =>
  mutationOptions({
    mutationFn: () => requests.deleteGenerationRequest(projectId, requestId),
    meta: {
      invalidateQueries: [['media', projectId, 'ai-assets']],
    },
  })

export const moveAssetToFolderMutationOptions = (projectId: string, assetId: string) =>
  mutationOptions({
    mutationFn: (folderId: string) => requests.moveAssetToFolder(projectId, assetId, folderId),
    meta: {
      invalidateQueries: [['media', projectId, 'ai-assets']],
    },
  })

export const updateHtmlAssetValuesMutationOptions = (projectId: string, assetId: string) =>
  mutationOptions({
    mutationFn: (values: Record<string, string | number | boolean>) =>
      requests.updateHtmlAssetValues(projectId, assetId, values),
    onSuccess: (updatedAsset, _variables, _onMutateResult, context) => {
      context.client.setQueriesData<AiGeneratedAssetsInfiniteData>(
        { queryKey: ['media', projectId, 'ai-assets'] },
        (old) => patchAiGeneratedAsset(old, updatedAsset),
      )
      context.client.setQueriesData<AssetRequestsInfiniteData>(
        { queryKey: mediaGeneratorKeys.assetsRequests(projectId) },
        (old) => patchAssetInRequests(old, updatedAsset),
      )
    },
  })

export const bulkMoveAssetsToFolderMutationOptions = (projectId: string) =>
  mutationOptions({
    mutationFn: ({ assetIds, folderId }: { assetIds: string[]; folderId: string }) =>
      requests.bulkMoveAssetsToFolder(projectId, assetIds, folderId),
    meta: {
      invalidateQueries: [['media', projectId, 'ai-assets']],
    },
  })

export const bulkDeleteAssetsMutationOptions = (projectId: string) =>
  mutationOptions({
    mutationFn: (assetIds: string[]) => requests.bulkDeleteAssets(projectId, assetIds),
    meta: {
      invalidateQueries: [['media', projectId, 'ai-assets']],
    },
  })

export const downloadAssetsZipMutationOptions = (projectId: string) =>
  mutationOptions({
    mutationFn: (assetIds: string[]) => requests.downloadAssetsZip(projectId, assetIds),
  })

export const useUpdateAssetsList = (projectId: string) => {
  const queryClient = useQueryClient()

  return useCallback((assets: MediaAsset[], requestId?: string) => {
    queryClient.setQueriesData<AiGeneratedAssetsInfiniteData>(
      { queryKey: ['media', projectId, 'ai-assets'] },
      (old) => appendAssetsToAiGeneratedRequests(old, assets, requestId),
    )
  }, [projectId, queryClient])
}

export const usePatchAiGeneratedRequest = (projectId: string) => {
  const queryClient = useQueryClient()

  return useCallback((requestId: string, patch: Partial<AiGeneratedMediaRequest>) => {
    queryClient.setQueriesData<AiGeneratedAssetsInfiniteData>(
      { queryKey: ['media', projectId, 'ai-assets'] },
      (old) => patchAiGeneratedRequest(old, requestId, patch),
    )
  }, [projectId, queryClient])
}

function toAiGeneratedMediaRequest(run: requests.MediaGenerationRun): AiGeneratedMediaRequest {
  return {
    id: run.id,
    projectId: run.projectId,
    status: run.status,
    request: run.request,
    error: run.error,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    assets: [],
  }
}

function toRequestAsset(asset: MediaAsset): AiGeneratedRequestAsset {
  return {
    id: asset.id,
    name: asset.name,
    url: asset.url,
    type: asset.type,
    metadata: asset.metadata,
    storageKey: asset.storageKey,
  }
}

function getAssetRequestId(asset: MediaAsset, fallbackRequestId?: string) {
  if (fallbackRequestId) return fallbackRequestId
  const streamedRequestId = (asset as MediaAsset & { generationRequestId?: string }).generationRequestId
  return streamedRequestId ?? asset.generationRequest?.id ?? null
}

function patchAiGeneratedAsset(
  current: AiGeneratedAssetsInfiniteData | undefined,
  updatedAsset: MediaAsset,
): AiGeneratedAssetsInfiniteData | undefined {
  if (!current) return current

  const nextAsset = toRequestAsset(updatedAsset)

  return {
    ...current,
    pages: current.pages.map((page) => ({
      ...page,
      data: page.data.map((request) => ({
        ...request,
        assets: request.assets.map((asset) =>
          asset.id === updatedAsset.id ? { ...asset, ...nextAsset } : asset,
        ),
      })),
    })),
  }
}

function patchAiGeneratedRequest(
  current: AiGeneratedAssetsInfiniteData | undefined,
  requestId: string,
  patch: Partial<AiGeneratedMediaRequest>,
): AiGeneratedAssetsInfiniteData | undefined {
  if (!current) return current

  return {
    ...current,
    pages: current.pages.map((page) => ({
      ...page,
      data: page.data.map((request) =>
        request.id === requestId ? { ...request, ...patch } : request,
      ),
    })),
  }
}

function patchAssetInRequests(
  current: AssetRequestsInfiniteData | undefined,
  updatedAsset: MediaAsset,
): AssetRequestsInfiniteData | undefined {
  if (!current) return current

  return {
    ...current,
    pages: current.pages.map((page) => ({
      ...page,
      data: page.data.map((request) => ({
        ...request,
        assets: (request.assets ?? []).map((asset) =>
          asset.assetId === updatedAsset.id
            ? { ...asset, url: updatedAsset.url, name: updatedAsset.name, type: updatedAsset.type }
            : asset,
        ),
      })),
    })),
  }
}

function appendAssetsToAiGeneratedRequests(
  current: AiGeneratedAssetsInfiniteData | undefined,
  assets: MediaAsset[],
  requestId?: string,
): AiGeneratedAssetsInfiniteData | undefined {
  if (!current || assets.length === 0) return current

  const assetsByRequestId = new Map<string, AiGeneratedRequestAsset[]>()
  for (const asset of assets) {
    const parentRequestId = getAssetRequestId(asset, requestId)
    if (!parentRequestId) continue
    const currentAssets = assetsByRequestId.get(parentRequestId) ?? []
    currentAssets.push(toRequestAsset(asset))
    assetsByRequestId.set(parentRequestId, currentAssets)
  }

  if (assetsByRequestId.size === 0) return current

  return {
    ...current,
    pages: current.pages.map((page) => ({
      ...page,
      data: page.data.map((request) => {
        const incoming = assetsByRequestId.get(request.id)
        if (!incoming) return request
        return { ...request, assets: mergeRequestAssets(request.assets, incoming) }
      }),
    })),
  }
}

function mergeRequestAssets(
  current: AiGeneratedRequestAsset[],
  incoming: AiGeneratedRequestAsset[],
): AiGeneratedRequestAsset[] {
  const existingIds = new Set(current.map((asset) => asset.id))
  const newAssets = incoming.filter((asset) => !existingIds.has(asset.id))
  return newAssets.length > 0 ? [...current, ...newAssets] : current
}

function prependAiGeneratedRequest(
  current: AiGeneratedAssetsInfiniteData | undefined,
  request: AiGeneratedMediaRequest,
): AiGeneratedAssetsInfiniteData {
  if (!current) {
    return {
      pages: [{
        data: [request],
        nextCursor: null,
        hasMore: false,
      }],
      pageParams: [undefined],
    }
  }

  let didReplace = false
  const pages = current.pages.map((page) => ({
    ...page,
    data: page.data.map((item) => {
      if (item.id !== request.id) return item
      didReplace = true
      return { ...item, ...request, assets: item.assets.length > 0 ? item.assets : request.assets }
    }),
  }))

  if (didReplace) {
    return { ...current, pages }
  }

  const [firstPage, ...restPages] = pages
  if (!firstPage) {
    return {
      ...current,
      pages: [{
        data: [request],
        nextCursor: null,
        hasMore: false,
      }],
    }
  }

  return {
    ...current,
    pages: [{ ...firstPage, data: [request, ...firstPage.data] }, ...restPages],
  }
}

function appendAssetRequest(
  current: AssetRequestsInfiniteData | undefined,
  request: requests.MediaGenerationRun,
): AssetRequestsInfiniteData {
  if (!current) {
    return {
      pages: [{
        data: [request],
        nextCursor: null,
        hasMore: false,
      }],
      pageParams: [undefined],
    }
  }

  let didReplace = false
  const pages = current.pages.map((page) => ({
    ...page,
    data: page.data.map((item) => {
      if (item.id !== request.id) return item
      didReplace = true
      return request
    }),
  }))

  if (didReplace) {
    return { ...current, pages }
  }

  // pages[0] is the newest batch (matches listMessages / chat upsert pattern).
  const [firstPage, ...restPages] = pages
  if (!firstPage) {
    return {
      ...current,
      pages: [{
        data: [request],
        nextCursor: null,
        hasMore: false,
      }],
    }
  }

  return {
    ...current,
    pages: [{ ...firstPage, data: [...firstPage.data, request] }, ...restPages],
  }
}
