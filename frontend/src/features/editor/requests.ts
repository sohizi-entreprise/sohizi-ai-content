import api from '@/lib/axios'

export const getFileContent = async (projectId: string, fileId: string): Promise<{content: string | Record<string, unknown>}> => {
  const response = await api.get(`/projects/${projectId}/files/${fileId}`)
  return response.data
}

export const saveFileContent = async (projectId: string, fileId: string, content: string): Promise<{content: string}> => {
  const response = await api.put(`/projects/${projectId}/files/${fileId}/content`, { content })
  return response.data
}