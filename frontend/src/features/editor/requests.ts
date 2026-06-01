import api from '@/lib/axios'
import type { FileContentResponse, Skill, PendingFileOperation } from './types'

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
  diffApplied?: boolean,
): Promise<{ content: string; revision: number }> => {
  const response = await api.put(
    `/projects/${projectId}/files/${fileId}/content`,
    { content, diffApplied },
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

export type SaveSkillPayload = {
  description?: string
  instructions?: string
}

export const saveSkill = async (
  projectId: string,
  fileId: string,
  skill: SaveSkillPayload,
): Promise<Skill> => {
  const response = await api.put(
    `/projects/${projectId}/files/${fileId}/skill`,
    skill,
  )
  return response.data
}

export const listPendingOperations = async (projectId: string): Promise<Array<PendingFileOperation>> => {
  const response = await api.get(`/projects/${projectId}/files/pending-operations`)
  return response.data
}

export const getPendingOperation = async (projectId: string, fileId: string): Promise<{operation: PendingFileOperation | null}> => {
  const response = await api.get(`/projects/${projectId}/files/${fileId}/pending-operations`)
  return response.data
}

export const deletePendingOperation = async (projectId: string, fileId: string): Promise<{ok: boolean}> => {
  const response = await api.delete(`/projects/${projectId}/files/${fileId}/pending-operations`)
  return response.data
}
