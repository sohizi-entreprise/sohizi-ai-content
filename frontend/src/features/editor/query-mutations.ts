import { mutationOptions, queryOptions } from '@tanstack/react-query'
import {
  getFileContent,
  saveSkill,
  saveFileContent,
  saveFileContentDiff,
} from './requests'
import type { CompactTextDiff, CursorPaginationOptions, SaveSkillPayload } from './requests'

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
}

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
    mutationFn: (content: string) =>
      saveFileContent(projectId, fileId, content),
    onSuccess: (data, _var, _, context) => {
      context.client.setQueryData(keysFactory.fileContent(projectId, fileId), {
        type: 'markdown',
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