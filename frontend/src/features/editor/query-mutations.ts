import { mutationOptions, queryOptions } from '@tanstack/react-query'
import {
  getFileContent,
  saveSkill,
  saveFileContent,
  saveFileContentDiff,
  listPendingOperations,
  getPendingOperation,
  deletePendingOperation,
} from './requests'
import type { CompactTextDiff, CursorPaginationOptions, SaveSkillPayload } from './requests'
import type { PendingFileOperation } from './types'

type SaveFileContentDiffVariables = {
  diff: CompactTextDiff
  baseRevision: number
}

const keysFactory = {
  fileContent: (
    projectId: string,
    fileId: string,
    paginationOptions?: CursorPaginationOptions,
  ) => [
    'project',
    projectId,
    'files',
    fileId,
    'content',
    { ...(paginationOptions ?? {}) },
  ],
  pendingOperations: (projectId: string) => [
    'project',
    projectId,
    'files',
    'pending-operations',
  ],
  pendingOperation: (projectId: string, fileId: string) => [
    'project',
    projectId,
    'files',
    fileId,
    'pending-operations',
  ],
}

export const getPendingOperationQueryKey = (projectId: string, fileId: string) => keysFactory.pendingOperation(projectId, fileId)

export const getFileContentQueryOptions = (
  projectId: string,
  fileId: string,
  paginationOptions?: CursorPaginationOptions,
) =>
  queryOptions({
    queryKey: keysFactory.fileContent(projectId, fileId, paginationOptions),
    queryFn: () => getFileContent(projectId, fileId, paginationOptions),
    enabled: !!projectId && !!fileId,
  })

export const saveFileContentMutationOptions = (
  projectId: string,
  fileId: string,
) =>
  mutationOptions({
    mutationFn: (data: {content: string, diffApplied?: boolean}) =>
      saveFileContent(projectId, fileId, data.content, data.diffApplied),
    onSuccess: (data, variables, _, context) => {
      context.client.setQueryData(keysFactory.fileContent(projectId, fileId), {
        type: 'markdown',
        content: data.content,
        revision: data.revision,
      })

      if (variables.diffApplied) {
        context.client.setQueryData(
          keysFactory.pendingOperation(projectId, fileId),
          (current: { operation: PendingFileOperation | null } | undefined) => {
            if (!current?.operation) return current
            return {
              operation: { ...current.operation, diffApplied: true },
            }
          },
        )
      }
    },
  })

export const saveFileContentDiffMutationOptions = (
  projectId: string,
  fileId: string,
) =>
  mutationOptions({
    mutationFn: ({ diff, baseRevision }: SaveFileContentDiffVariables) =>
      saveFileContentDiff(projectId, fileId, diff, baseRevision),
    onSuccess: (data, _var, _, context) => {
      context.client.setQueryData(keysFactory.fileContent(projectId, fileId), {
        type: 'markdown',
        content: data.content,
        revision: data.revision,
      })
    },
  })


export const saveSkillMutationOptions = (
  projectId: string,
  fileId: string,
) =>
  mutationOptions({
    mutationFn: (skill: SaveSkillPayload) =>
      saveSkill(projectId, fileId, skill),
    onSuccess: (data, _var, _, context) => {
      context.client.setQueryData(keysFactory.fileContent(projectId, fileId), {
        type: 'skill',
        data,
      })
    },
})

export const listPendingOperationsQueryOptions = (projectId: string) =>
  queryOptions({
    queryKey: keysFactory.pendingOperations(projectId),
    queryFn: () => listPendingOperations(projectId),
    enabled: !!projectId,
  })

export const getPendingOperationQueryOptions = (projectId: string, fileId: string) =>
  queryOptions({
    queryKey: keysFactory.pendingOperation(projectId, fileId),
    queryFn: () => getPendingOperation(projectId, fileId),
    enabled: !!projectId && !!fileId,
})

export const deletePendingOperationMutationOptions = (projectId: string, fileId: string) =>
  mutationOptions({
    mutationFn: () => deletePendingOperation(projectId, fileId),
    meta: {
      invalidateQueries: [keysFactory.pendingOperations(projectId)],
    },
    onSuccess: (_data, _var, _, context) => {
      context.client.setQueryData(keysFactory.pendingOperation(projectId, fileId), {operation: null})
    }
})