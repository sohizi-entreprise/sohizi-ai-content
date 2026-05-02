import { mutationOptions, queryOptions } from '@tanstack/react-query'
import {
  getFileContent,
  saveFileContent,
  saveFileContentDiff,
} from './requests'
import type { CompactTextDiff } from './requests'

type SaveFileContentDiffVariables = {
  diff: CompactTextDiff
  baseRevision: number
}

const keysFactory = {
  fileContent: (projectId: string, fileId: string) => [
    'project',
    projectId,
    'files',
    fileId,
    'content',
  ],
}

export const getFileContentQueryOptions = (projectId: string, fileId: string) =>
  queryOptions({
    queryKey: keysFactory.fileContent(projectId, fileId),
    queryFn: () => getFileContent(projectId, fileId),
    enabled: !!projectId && !!fileId,
  })

export const saveFileContentMutationOptions = (
  projectId: string,
  fileId: string,
) =>
  mutationOptions({
    mutationFn: (content: string) =>
      saveFileContent(projectId, fileId, content),
    onSuccess: (data, _var, _, context) => {
      context.client.setQueryData(keysFactory.fileContent(projectId, fileId), {
        content: data.content,
        revision: data.revision,
      })
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
        content: data.content,
        revision: data.revision,
      })
    },
  })
