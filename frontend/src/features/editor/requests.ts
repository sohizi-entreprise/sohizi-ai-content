import api from '@/lib/axios'
import { FileContentResponse } from './types'

export type CursorPaginationOptions = {
  cursor?: string
  limit?: number
}

export const getFileContent = async (
  projectId: string,
  fileId: string,
  paginationOptions?: CursorPaginationOptions
): Promise<FileContentResponse> => {
  const response = await api.get(`/projects/${projectId}/files/${fileId}`, { params: paginationOptions })
  return response.data
}

export type CompactTextDiff = {
  version: 1
  baseLength: number
  targetLength: number
  edits: Array<{
    start: number
    deleteCount: number
    insert: string
  }>
}

export const saveFileContent = async (
  projectId: string,
  fileId: string,
  content: string,
): Promise<{ content: string; revision: number }> => {
  const response = await api.put(
    `/projects/${projectId}/files/${fileId}/content`,
    { content },
  )
  return response.data
}

export const saveFileContentDiff = async (
  projectId: string,
  fileId: string,
  diff: CompactTextDiff,
  baseRevision: number,
): Promise<{ content: string; revision: number }> => {
  const response = await api.put(
    `/projects/${projectId}/files/${fileId}/content`,
    { diff, baseRevision },
  )
  return response.data
}
