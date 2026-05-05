import { useCallback } from 'react'
import type { InfiniteData, QueryClient } from '@tanstack/react-query'
import type { Message, ChatCompletionRequest, Conversation } from '../types'
import { v4 as uuidv4 } from 'uuid'
import { useChatStore } from '../store/chat-store'
import { completeChat, type CursorPaginationResult } from '../requests'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { getMessageQueryKey, getConversationQueryKey } from '../query-mutation'

type ChatInfiniteData<T> = InfiniteData<CursorPaginationResult<T>, string | undefined>

const createPage = <T>(data: T[]): CursorPaginationResult<T> => ({
  data,
  nextCursor: null,
  hasMore: false,
})

export const useSendMessage = (projectId: string) => {
  const queryClient = useQueryClient();

  const clearInput = useChatStore((state) => state.clearInput)
  const setPendingMessage = useChatStore((state) => state.setPendingMessage)
  const appendChunk = useChatStore((state) => state.appendChunk)
  const setIsStreaming = useChatStore((state) => state.setIsStreaming)
  const setActiveConversation = useChatStore((state) => state.setActiveConversation)
  const clearStreamingMessages = useChatStore((state) => state.clearStreamingMessages)


  return useCallback(async (payload: ChatCompletionRequest) => {
    let resolvedConversationId = payload.conversationId
    const userMsg: Message = {
      id: uuidv4(),
      role: 'user',
      content: [{type: 'text', text: payload.userPrompt}],
      createdAt: new Date().toISOString(),
    }

    setPendingMessage(userMsg)
    clearInput()

    setIsStreaming(true)

    try {
      for await (const chunk of completeChat(projectId, payload)) {
        if(chunk.type === 'identifier') {
          resolvedConversationId = chunk.conversationId

          if(!payload.conversationId){
            const now = new Date().toISOString()
            const conversation: Conversation = {
              id: chunk.conversationId,
              projectId,
              title: chunk.conversationTitle,
              createdAt: now,
              updatedAt: now,
            }
            setActiveConversation(conversation)
            updateConversationCache(queryClient, projectId, conversation)
          }

          // We update tanstack cache with the user message
          await queryClient.cancelQueries({ queryKey: getMessageQueryKey(projectId, chunk.conversationId) })
          updateMessagesCache(queryClient, projectId, chunk.conversationId, [userMsg])

        }
        appendChunk(chunk)
      }

      const { streamingMessages } = useChatStore.getState()
      if(resolvedConversationId){
        updateMessagesCache(queryClient, projectId, resolvedConversationId, [userMsg, ...streamingMessages])
        setPendingMessage(null)
        clearStreamingMessages()
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      setPendingMessage(null)
      clearStreamingMessages()
      toast.error(errorMessage)
    } finally {
      setIsStreaming(false)
    }
  }, [appendChunk, clearInput, clearStreamingMessages, projectId, queryClient, setIsStreaming, setPendingMessage, setActiveConversation])

}

function updateMessagesCache(queryClient: QueryClient, projectId: string, conversationId: string, msgs: Message[]){
  if (msgs.length === 0) return

  queryClient.setQueryData<ChatInfiniteData<Message>>(getMessageQueryKey(projectId, conversationId), (old) => {
    if (!old || old.pages.length === 0) {
      return {
        pages: [createPage(msgs)],
        pageParams: [undefined],
      }
    }

    return {
      ...old,
      pages: old.pages.map((page, index) =>
        index === 0
          ? { ...page, data: mergeMessages(page.data, msgs) }
          : page
      ),
    }
  })
}

function mergeMessages(current: Message[], next: Message[]) {
  const seen = new Set(current.map((message) => message.id))
  const uniqueNext = next.filter((message) => {
    if (seen.has(message.id)) return false
    seen.add(message.id)
    return true
  })

  return [...current, ...uniqueNext]
}

function updateConversationCache(queryClient: QueryClient, projectId: string, conversation: Conversation){
  queryClient.setQueryData<ChatInfiniteData<Conversation>>(getConversationQueryKey(projectId), (old) => {
    if (!old || old.pages.length === 0) {
      return {
        pages: [createPage([conversation])],
        pageParams: [undefined],
      }
    }

    return {
      ...old,
      pages: old.pages.map((page, index) =>
        index === 0
          ? { ...page, data: [conversation, ...page.data] }
          : page
      ),
    }
  })
}

