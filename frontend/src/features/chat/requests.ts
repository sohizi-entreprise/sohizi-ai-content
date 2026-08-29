import type {
  CursorPaginationOptions,
  CursorPaginationResult,
} from '@/lib/pagination'
import type {
  AgentRunBlock,
  ChatCompletionRequest,
  ChatCompletionResponse,
  Conversation,
  LlmModel,
} from './types'
import api from '@/lib/axios'

export type { CursorPaginationOptions, CursorPaginationResult }

export type DeleteConversationResponse = {
  ok: boolean
  error: string | null
}

export const listConversations = async (
  projectId: string,
  options?: CursorPaginationOptions,
): Promise<CursorPaginationResult<Conversation>> => {
  const response = await api.get(`/chats/${projectId}/conversations`, {
    params: options,
  })
  return response.data
}

export const deleteConversation = async (
  projectId: string,
  id: string,
): Promise<DeleteConversationResponse> => {
  const response = await api.delete(`/chats/${projectId}/conversations/${id}`)
  return response.data
}

export const listModels = async (
  projectId: string,
  categories: Array<string>,
): Promise<Array<LlmModel>> => {
  const response = await api.get(`/chats/${projectId}/models`, {
    params: { categories: categories.join(',') },
  })
  return response.data
}

export const listAgentRuns = async (
  projectId: string,
  conversationId: string,
  options?: CursorPaginationOptions,
): Promise<CursorPaginationResult<AgentRunBlock>> => {
  const response = await api.get(
    `/chats/${projectId}/conversations/${conversationId}/runs`,
    { params: options },
  )
  return response.data
}

export const submitChatCompletion = async (
  projectId: string,
  data: ChatCompletionRequest,
): Promise<ChatCompletionResponse> => {
  const response = await api.post(`/chats/${projectId}/conversations`, data)
  return response.data
}
