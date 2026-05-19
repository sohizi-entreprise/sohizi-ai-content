import api from '@/lib/axios'

export type GenerationRequestStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'aborted'
export type GenerationRequestType = 'image' | 'video' | 'audio'

export type GenerationRequestNotification = {
  id: string
  status: GenerationRequestStatus
  type: GenerationRequestType
  request: Record<string, unknown> | null
  error?: string | null
  createdAt: string
  updatedAt: string
}

export const getPendingRequests = async (
  projectId: string,
): Promise<Array<GenerationRequestNotification>> => {
  const response = await api.get(`/media/${projectId}/requests`)
  return response.data
}

export const getRequestStatuses = async (
  projectId: string,
  requestIds: Array<string>,
): Promise<Array<GenerationRequestNotification>> => {
  const response = await api.post(`/media/${projectId}/requests/status`, {
    requestIds,
  })
  return response.data
}
