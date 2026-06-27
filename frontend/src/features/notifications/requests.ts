import api from '@/lib/axios'

export type GenerationRequestStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'aborted'
export type GenerationRequestType =
  | 'chat-completion'
  | 'media-generation'
  | 'caption-generation'

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
  const response = await api.get(`/generations/pending/${projectId}`)
  return response.data
}

export const getRequestStatuses = async (
  projectId: string,
  requestIds: Array<string>,
): Promise<Array<GenerationRequestNotification>> => {
  const response = await api.post(`/generations/statuses/${projectId}`, {
    requestIds,
  })
  return response.data
}

export type ChatCompletionResponse = {
  requestId: string
  requestType: 'chat-completion'
}

export type MediaGenerationResponse = {
  requestId: string
  requestType: 'media-generation'
}

export const submitChatCompletion = async (
  projectId: string,
  data: Record<string, unknown>,
): Promise<ChatCompletionResponse> => {
  const response = await api.post(
    `/generations/chat-completion/${projectId}`,
    data,
  )
  return response.data
}

export const submitMediaGeneration = async (
  projectId: string,
  data: Record<string, unknown>,
): Promise<MediaGenerationResponse> => {
  const response = await api.post(`/generations/media/${projectId}`, data)
  return response.data
}

export const cancelGenerationRequest = async (
  projectId: string,
  requestId: string,
): Promise<void> => {
  await api.post(`/generations/cancel/${projectId}/${requestId}`)
}
