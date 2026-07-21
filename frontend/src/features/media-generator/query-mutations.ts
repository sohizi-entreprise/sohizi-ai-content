import { mutationOptions, infiniteQueryOptions, keepPreviousData, queryOptions, type InfiniteData, useQueryClient } from "@tanstack/react-query";
import * as requests from './requests';
import { MediaAsset } from "./requests";
import { useCallback } from "react";

type AssetRequestsInfiniteData = InfiniteData<
  requests.CursorPaginationResult<requests.MediaGenerationRun>,
  string | undefined
>

type AiGeneratedAssetsInfiniteData = InfiniteData<
  requests.CursorPaginationResult<requests.MediaAsset>,
  string | undefined
>

export const mediaGeneratorKeys = {
  assetsRequests: (projectId: string, options?: requests.ListAssetsOptions) => ['media', projectId, 'assets', options],
  aiGeneratedAssets: (projectId: string, options?: requests.ListAssetsOptions) => ['media', projectId, 'ai-assets', options],
  googleVoices: ['media', 'google-voices'] as const,
}

export const listGoogleVoicesQueryOptions = queryOptions({
  queryKey: mediaGeneratorKeys.googleVoices,
  queryFn: () => requests.listGoogleVoices(),
  staleTime: Infinity,
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

export const startGenerationMutationOptions = (projectId: string) =>
  mutationOptions({
    mutationFn: (data: requests.AssetRequest) => requests.startGeneration(projectId, data),
    onSuccess: (data, _variables, _onMutateResult, context) => {
      context.client.setQueriesData<AssetRequestsInfiniteData>(
        { queryKey: mediaGeneratorKeys.assetsRequests(projectId) },
        (old) => appendAssetRequest(old, data),
      )
    },
   
})


export const cancelGenerationMutationOptions = (projectId: string, requestId: string) =>
  mutationOptions({
    mutationFn: () => requests.cancelGeneration(projectId, requestId),
    meta: {
      invalidateQueries: [mediaGeneratorKeys.assetsRequests(projectId), mediaGeneratorKeys.aiGeneratedAssets(projectId)],
    },
})

export const deleteAssetMutationOptions = (projectId: string, assetId: string) =>
  mutationOptions({
    mutationFn: () => requests.deleteAsset(projectId, assetId),
    meta: {
      invalidateQueries: [mediaGeneratorKeys.aiGeneratedAssets(projectId)],
    },
  })

export const moveAssetToFolderMutationOptions = (projectId: string, assetId: string) =>
  mutationOptions({
    mutationFn: (folderId: string) => requests.moveAssetToFolder(projectId, assetId, folderId),
    meta: {
      invalidateQueries: [mediaGeneratorKeys.aiGeneratedAssets(projectId)],
    },
  })

export const updateHtmlAssetValuesMutationOptions = (projectId: string, assetId: string) =>
  mutationOptions({
    mutationFn: (values: Record<string, string | number | boolean>) =>
      requests.updateHtmlAssetValues(projectId, assetId, values),
    onSuccess: (updatedAsset, _variables, _onMutateResult, context) => {
      context.client.setQueriesData<AiGeneratedAssetsInfiniteData>(
        { queryKey: mediaGeneratorKeys.aiGeneratedAssets(projectId) },
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
      invalidateQueries: [mediaGeneratorKeys.aiGeneratedAssets(projectId)],
    },
  })

export const bulkDeleteAssetsMutationOptions = (projectId: string) =>
  mutationOptions({
    mutationFn: (assetIds: string[]) => requests.bulkDeleteAssets(projectId, assetIds),
    meta: {
      invalidateQueries: [mediaGeneratorKeys.aiGeneratedAssets(projectId)],
    },
  })

export const downloadAssetsZipMutationOptions = (projectId: string) =>
  mutationOptions({
    mutationFn: (assetIds: string[]) => requests.downloadAssetsZip(projectId, assetIds),
  })

export const useUpdateAssetsList = (projectId: string) => {
  const queryClient = useQueryClient()

  return useCallback ((assets: MediaAsset[]) => {
    queryClient.setQueriesData<AiGeneratedAssetsInfiniteData>(
      { queryKey: mediaGeneratorKeys.aiGeneratedAssets(projectId) },
      (old) => appendAiGeneratedAssets(old, assets),
    )

    // queryClient.setQueriesData<AssetRequestsInfiniteData>(
    //   { queryKey: mediaGeneratorKeys.assetsRequests(projectId) },
    //   (old) => updateAssetRequestAssets(old, requestId, assets),
    // )
  }, [projectId, queryClient])
}

function patchAiGeneratedAsset(
  current: AiGeneratedAssetsInfiniteData | undefined,
  updatedAsset: MediaAsset,
): AiGeneratedAssetsInfiniteData | undefined {
  if (!current) return current

  return {
    ...current,
    pages: current.pages.map((page) => ({
      ...page,
      data: page.data.map((asset) =>
        asset.id === updatedAsset.id ? { ...asset, ...updatedAsset } : asset,
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
          asset.id === updatedAsset.id ? { ...asset, ...updatedAsset } : asset,
        ),
      })),
    })),
  }
}

function appendAiGeneratedAssets(
  current: AiGeneratedAssetsInfiniteData | undefined,
  assets: MediaAsset[],
): AiGeneratedAssetsInfiniteData {
  const aiGeneratedAssets = assets.filter((asset) => asset.source === 'ai-generated')

  if (!current) {
    return {
      pages: [{
        data: aiGeneratedAssets,
        nextCursor: null,
        hasMore: false,
      }],
      pageParams: [undefined],
    }
  }

  if (aiGeneratedAssets.length === 0) return current

  const existingAssetIds = new Set(current.pages.flatMap((page) => page.data.map((asset) => asset.id)))
  const newAssets = aiGeneratedAssets.filter((asset) => !existingAssetIds.has(asset.id))

  if (newAssets.length === 0) return current

  const firstPage = current.pages[0]
  if (!firstPage) {
    return {
      ...current,
      pages: [{
        data: newAssets,
        nextCursor: null,
        hasMore: false,
      }],
    }
  }

  const remainingPages = current.pages.slice(1)
  return {
    ...current,
    pages: [{ ...firstPage, data: [...newAssets, ...firstPage.data] }, ...remainingPages],
  }
}

// function updateAssetRequestAssets(
//   current: AssetRequestsInfiniteData | undefined,
//   requestId: string,
//   assets: MediaAsset[],
// ): AssetRequestsInfiniteData | undefined {
//   if (!current) return current

//   return {
//     ...current,
//     pages: current.pages.map((page) => ({
//       ...page,
//       data: page.data.map((request) => (
//         request.id === requestId
//           ? { ...request, assets: mergeAssets(request.assets, assets) }
//           : request
//       )),
//     })),
//   }
// }

// function mergeAssets(current: MediaAsset[], next: MediaAsset[]): MediaAsset[] {
//   const currentAssetIds = new Set(current.map((asset) => asset.id))
//   const newAssets = next.filter((asset) => !currentAssetIds.has(asset.id))

//   return newAssets.length > 0 ? [...current, ...newAssets] : current
// }

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