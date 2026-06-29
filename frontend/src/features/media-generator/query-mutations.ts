import { mutationOptions, infiniteQueryOptions, keepPreviousData } from "@tanstack/react-query";
import * as requests from './requests';

export const mediaGeneratorKeys = {
  assetsRequests: (projectId: string, options?: requests.ListAssetsOptions) => ['media', projectId, 'assets', options],
  aiGeneratedAssets: (projectId: string, options?: requests.ListAssetsOptions) => ['media', projectId, 'ai-assets', options],
}

export const listAssetsRequestsQueryOptions = (projectId: string, options?: requests.ListAssetsOptions) =>
  infiniteQueryOptions({
    queryKey: ['media', projectId, 'assets', options],
    queryFn: ({ pageParam }) => requests.listAssetsRequests(projectId, { ...options, cursor: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    placeholderData: keepPreviousData,
  })

export const listAiGeneratedAssetsQueryOptions = (projectId: string, options?: requests.ListAssetsOptions) =>
  infiniteQueryOptions({
    queryKey: ['media', projectId, 'ai-assets', options],
    queryFn: ({ pageParam }) => requests.listAiGeneratedAssets(projectId, { ...options, cursor: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    placeholderData: keepPreviousData,
})

export const startGenerationMutationOptions = (projectId: string) =>
  mutationOptions({
    mutationFn: (data: requests.AssetRequest) => requests.startGeneration(projectId, data),
    meta: {
      invalidateQueries: [mediaGeneratorKeys.assetsRequests(projectId), mediaGeneratorKeys.aiGeneratedAssets(projectId)],
    },
})


export const cancelGenerationMutationOptions = (projectId: string, requestId: string) =>
  mutationOptions({
    mutationFn: () => requests.cancelGeneration(projectId, requestId),
    meta: {
      invalidateQueries: [mediaGeneratorKeys.assetsRequests(projectId), mediaGeneratorKeys.aiGeneratedAssets(projectId)],
    },
})