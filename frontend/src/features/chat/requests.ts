import api from "@/lib/axios"
import { Conversation, ConversationRun, SendMessageInput } from "./types"

export const createConversation = async (projectId: string): Promise<Conversation> => {
    const response = await api.post(`/chats/${projectId}/conversations`)
    return response.data
}

export const listConversations = async (projectId: string): Promise<Conversation[]> => {
    const response = await api.get(`/chats/${projectId}/conversations`)
    return response.data
}

export const deleteConversation = async (projectId: string, id: string): Promise<{ confirmed: boolean }> => {
    const response = await api.delete(`/chats/${projectId}/conversations/${id}`)
    return response.data
}

export const getConversationMessages = async (projectId: string, id: string): Promise<ConversationRun[]> => {
    const response = await api.get(`/chats/${projectId}/conversations/${id}/messages`)
    return response.data
}

export type SendMessageResponse = {
    success: boolean
    streamId: string
    runId: string
    userMessageId: string
    conversation: Conversation
}

export const sendMessage = async(projectId: string, data: SendMessageInput): Promise<SendMessageResponse> => {
    const response = await api.post(`/chats/${projectId}/conversations/messages`, data)
    return response.data
}