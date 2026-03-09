import { queryOptions, mutationOptions } from '@tanstack/react-query'
import * as requests from './requests'
import { SendMessageInput } from './types'

const keysFactory = {
    conversations: (projectId: string) => ['conversations', projectId],
    conversationMessages: (projectId: string, id: string) => ['conversationMessages', projectId, id],
}

export const createConversationMutationOptions = (projectId: string) => mutationOptions({
    mutationFn: () => requests.createConversation(projectId),
    meta: {
        invalidateQueries: [keysFactory.conversations(projectId)],
    },
})

export const deleteConversationMutationOptions = (projectId: string, id: string) => mutationOptions({
    mutationFn: () => requests.deleteConversation(projectId, id),
    meta: {
        invalidateQueries: [keysFactory.conversations(projectId)],
    },
})

export const listConversationsQueryOptions = (projectId: string) => queryOptions({
    queryKey: keysFactory.conversations(projectId),
    queryFn: () => requests.listConversations(projectId),
})

export const getConversationMessagesQueryOptions = (projectId: string, id: string) => queryOptions({
    queryKey: keysFactory.conversationMessages(projectId, id),
    queryFn: () => requests.getConversationMessages(projectId, id),
})

export const sendMessageMutationOptions = (projectId: string) => mutationOptions({
    mutationFn: (data: SendMessageInput) => requests.sendMessage(projectId, data),
    // meta: {
    //     invalidateQueries: [keysFactory.conversationMessages(projectId, id)],
    // },
})