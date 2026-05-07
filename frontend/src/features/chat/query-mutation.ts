import { queryOptions, mutationOptions, infiniteQueryOptions, keepPreviousData } from '@tanstack/react-query'
import * as requests from './requests'

const keysFactory = {
    conversations: (projectId: string, options?: requests.CursorPaginationOptions) => ['conversations', projectId, options],
    messages: (projectId: string, conversationId: string, options?: requests.CursorPaginationOptions) => ['messages', projectId, conversationId, options],
    models: (projectId: string) => ['models', projectId],
    fileNameSearch: (projectId: string, name: string, limit: number) => ['file-name-search', projectId, name, limit],
}

export const deleteConversationMutationOptions = (projectId: string) => mutationOptions({
    mutationFn: (conversationId: string) => requests.deleteConversation(projectId, conversationId),
    meta: {
        invalidateQueries: [keysFactory.conversations(projectId)],
    },
    onSuccess(_data, conversationId, _onMutateResult, context) {
        context.client.removeQueries({ queryKey: keysFactory.messages(projectId, conversationId) })
    },
})

export const listConversationsQueryOptions = (
    projectId: string,
    options?: requests.CursorPaginationOptions,
) => infiniteQueryOptions({
    queryKey: keysFactory.conversations(projectId, options),
    queryFn: ({ pageParam }) => requests.listConversations(projectId, { ...options, cursor: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: options?.cursor as string | undefined,
    select: (data) => data.pages.flatMap(page => page.data),
    placeholderData: keepPreviousData,
})


export const listMessagesInfiniteQueryOptions = (projectId: string, conversationId: string | null) => infiniteQueryOptions({
    queryKey: keysFactory.messages(projectId, conversationId ?? 'empty'),
    queryFn: ({ pageParam }) => {
        if (!conversationId) return Promise.reject(new Error('Conversation ID is required'))
        return requests.getConversationMessages(projectId, conversationId, { cursor: pageParam })
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    select: (data) => data.pages.flatMap(page => page.data),
    enabled: !!conversationId,
    placeholderData: conversationId ? keepPreviousData : undefined,
})

export const listModelsQueryOptions = (projectId: string) => queryOptions({
    queryKey: keysFactory.models(projectId),
    queryFn: () => requests.listModels(projectId),
})

export const searchFilesByNameQueryOptions = (projectId: string, name: string, limit = 15) => queryOptions({
    queryKey: keysFactory.fileNameSearch(projectId, name, limit),
    queryFn: ({ signal }) => requests.searchFilesByName(projectId, name, limit, { signal }),
    enabled: name.trim().length > 0,
})

export const getMessageQueryKey = (projectId: string, conversationId: string) => keysFactory.messages(projectId, conversationId)
export const getConversationQueryKey = (projectId: string) => keysFactory.conversations(projectId)

