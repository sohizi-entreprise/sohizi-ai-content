import api from '@/lib/axios'

export type FileContentResponse = {
  content: string | Record<string, unknown>
  revision: number
}

export const getFileContent = async (
  projectId: string,
  fileId: string,
): Promise<FileContentResponse> => {
  const response = await api.get(`/projects/${projectId}/files/${fileId}`)
  return response.data
}

export type CompactTextDiff = {
  version: 1
  baseLength: number
  baseHash: number
  targetLength: number
  targetHash: number
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
