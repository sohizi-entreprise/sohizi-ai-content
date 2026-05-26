import { queryOptions, mutationOptions } from '@tanstack/react-query'
import { loadComposition, batchEdit, createComposition } from './requests'
import type { BatchOperation, CreateCompositionInput } from './requests'

const keysFactory = {
  composition: (projectId: string, fileNodeId: string) => [
    'video-editor',
    'composition',
    projectId,
    fileNodeId,
  ],
}

export const loadCompositionQueryOptions = (
  projectId: string,
  fileNodeId: string,
) =>
  queryOptions({
    queryKey: keysFactory.composition(projectId, fileNodeId),
    queryFn: () => loadComposition(projectId, fileNodeId),
    enabled: !!projectId && !!fileNodeId,
    gcTime: 0,
    refetchOnWindowFocus: false,
  })

export const createCompositionMutationOptions = (projectId: string) =>
  mutationOptions({
    mutationFn: (input: CreateCompositionInput) =>
      createComposition(projectId, input),
  })

export const batchEditMutationOptions = (
  projectId: string,
  compositionId: string,
) =>
  mutationOptions({
    mutationFn: (operations: BatchOperation[]) =>
      batchEdit(projectId, compositionId, operations),
  })
