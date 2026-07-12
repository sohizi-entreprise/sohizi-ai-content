import { queryOptions, mutationOptions, infiniteQueryOptions, keepPreviousData, type InfiniteData } from '@tanstack/react-query'
import * as requests from './requests'
import type { AgentRunBlock, ChatCompletionRequest } from './types'
import { searchFilesByName } from '@/features/projects/request'

type AgentRunsInfiniteData = InfiniteData<requests.CursorPaginationResult<AgentRunBlock>, string | undefined>

const keysFactory = {
    conversations: (projectId: string, options?: requests.CursorPaginationOptions) => ['conversations', projectId, options],
    messages: (projectId: string, conversationId: string, options?: requests.CursorPaginationOptions) => ['messages', projectId, conversationId, options],
    models: (projectId: string, categories: string[]) => ['models', projectId, categories],
    fileNameSearch: (projectId: string, name: string, limit: number) => ['file-name-search', projectId, name, limit],
    agentRuns: (projectId: string, conversationId: string, options?: requests.CursorPaginationOptions) => ['agent-runs', projectId, conversationId, options],
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
    select: (data) => [...data.pages].reverse().flatMap(page => page.data),
    enabled: !!conversationId,
    placeholderData: conversationId ? keepPreviousData : undefined,
})

export const listAgentRunsInfiniteQueryOptions = (projectId: string, conversationId: string, isNew: boolean, options?: requests.CursorPaginationOptions) => infiniteQueryOptions({
    queryKey: keysFactory.agentRuns(projectId, conversationId, options),
    queryFn: ({ pageParam }) => {
        if(isNew){
            return {
                data: [],
                nextCursor: null,
                hasMore: false,
            }
        }
        return requests.listAgentRuns(projectId, conversationId, { cursor: pageParam })
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: options?.cursor as string | undefined,
    select: (data) => data.pages.flatMap(page => page.data),
    placeholderData: conversationId ? keepPreviousData : undefined,
})

export const cancelRunMutationOptions = (projectId: string, conversationId: string, runId: string) => mutationOptions({
    mutationFn: () => requests.cancelRun(projectId, conversationId, runId),
    onSuccess(_data, _variables, _onMutateResult, context) {
        context.client.setQueriesData<InfiniteData<requests.CursorPaginationResult<AgentRunBlock>, string | undefined>>(
            { queryKey: keysFactory.agentRuns(projectId, conversationId) },
            (old) => {
                if (!old) return old

                return {
                    ...old,
                    pages: old.pages.map((page) => ({
                        ...page,
                        data: page.data.map((run) => ({
                            ...run,
                            status: 'finished',
                        })),
                    })),
                }
            },
        )
    },
})

export const submitChatCompletionMutationOptions = (projectId: string) => mutationOptions({
    mutationFn: (data: ChatCompletionRequest) => {
        const conversationId = data.isNew ? null : data.conversationId
        const payload = {...data, conversationId}
        return requests.submitChatCompletion(projectId, payload)
    },
    onSuccess(data, variables, _onMutateResult, context) {
        const conversationId = data.conversation.id
        const isNewConversation = variables.isNew

        if(isNewConversation){
          context.client.invalidateQueries({ queryKey: keysFactory.conversations(projectId) })
        }

        if (variables.isNew && variables.conversationId && variables.conversationId !== conversationId) {
            context.client.removeQueries({ queryKey: keysFactory.agentRuns(projectId, variables.conversationId) })
        }

        context.client.setQueryData<AgentRunsInfiniteData>(
            keysFactory.agentRuns(projectId, conversationId),
            (old) => upsertAgentRun(old, data.run, 'append'),
        )
    },
})

function upsertAgentRun(
    current: AgentRunsInfiniteData | undefined,
    run: AgentRunBlock,
    placement: 'prepend' | 'append',
    replaceId?: string,
): AgentRunsInfiniteData {
    if (!current) {
        return {
            pages: [{
                data: [run],
                nextCursor: null,
                hasMore: false,
            }],
            pageParams: [undefined],
        }
    }

    let didReplace = false
    const pages = current.pages.map((page) => ({
        ...page,
        data: page.data.map((item) => {
            if (item.id !== run.id && item.id !== replaceId) return item
            didReplace = true
            return run
        }),
    }))

    if (didReplace) {
        return { ...current, pages }
    }

    const [firstPage, ...restPages] = pages
    if (!firstPage) {
        return current
    }

    const data = placement === 'prepend'
        ? [run, ...firstPage.data]
        : [...firstPage.data, run]

    return {
        ...current,
        pages: [{ ...firstPage, data }, ...restPages],
    }
}

export const listModelsQueryOptions = (projectId: string, categories: string[]) => queryOptions({
    queryKey: keysFactory.models(projectId, categories),
    queryFn: () => requests.listModels(projectId, categories),
})

export const searchFilesByNameQueryOptions = (projectId: string, name: string, limit = 15) => queryOptions({
    queryKey: keysFactory.fileNameSearch(projectId, name, limit),
    queryFn: ({ signal }) => searchFilesByName(projectId, name, limit, { signal }),
    enabled: name.trim().length > 0,
})

export const getMessageQueryKey = (projectId: string, conversationId: string) => keysFactory.messages(projectId, conversationId)
export const getConversationQueryKey = (projectId: string) => keysFactory.conversations(projectId)

