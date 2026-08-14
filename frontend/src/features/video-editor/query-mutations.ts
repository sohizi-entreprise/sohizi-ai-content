import { mutationOptions, queryOptions } from '@tanstack/react-query'
import {
  batchEdit,
  cancelRender,
  createComposition,
  createRender,
  generateCaption,
  getRender,
  loadComposition,
} from './requests'
import type {
  BatchOperation,
  CreateCompositionInput,
  CreateRenderInput,
  RenderJob,
} from './requests'

const keysFactory = {
  composition: (projectId: string, fileNodeId: string) => [
    'video-editor',
    'composition',
    projectId,
    fileNodeId,
  ],
  render: (projectId: string, renderJobId: string) => [
    'video-editor',
    'render',
    projectId,
    renderJobId,
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
    mutationFn: (operations: Array<BatchOperation>) =>
      batchEdit(projectId, compositionId, operations),
  })

export const generateCaptionMutationOptions = (projectId: string) =>
  mutationOptions({
    mutationFn: (trackId: string) => generateCaption(projectId, trackId),
    meta: {
      // invalidateQueries: [keysFactory.composition(projectId, fileNodeId)],
    },
  })

// ============================================================================
// Renders
// ============================================================================

const isRenderRunning = (job: RenderJob | undefined) =>
  job?.status === 'queued' || job?.status === 'rendering'

export const renderQueryOptions = (
  projectId: string,
  renderJobId: string | null,
) =>
  queryOptions({
    queryKey: keysFactory.render(projectId, renderJobId ?? 'none'),
    queryFn: () => getRender(projectId, renderJobId!),
    enabled: !!projectId && !!renderJobId,
    // Server-side rendering is long running, so the editor polls while it runs.
    refetchInterval: ({ state }) =>
      isRenderRunning(state.data) ? 2000 : false,
    gcTime: 0,
  })

export const createRenderMutationOptions = (
  projectId: string,
  compositionId: string,
) =>
  mutationOptions({
    mutationFn: (input: CreateRenderInput) =>
      createRender(projectId, compositionId, input),
  })

export const cancelRenderMutationOptions = (projectId: string) =>
  mutationOptions({
    mutationFn: (renderJobId: string) => cancelRender(projectId, renderJobId),
  })
