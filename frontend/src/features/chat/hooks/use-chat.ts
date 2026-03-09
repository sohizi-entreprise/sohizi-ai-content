import { useCallback } from 'react'
import type { Message, SendMessageInput, ConversationRun } from '../types'
import { useMutation } from '@tanstack/react-query'
import { createConversationMutationOptions, sendMessageMutationOptions } from '../query-mutation'
import { useConversationStore } from '../store/conversation-store'
import { v4 as uuidv4 } from 'uuid'
import { useChatStore } from '../store/chat-store'


export const useSendMessage = (projectId: string) => {
  const {mutate: sendMessage} = useMutation(sendMessageMutationOptions(projectId))
  const setCurrentConversation = useConversationStore(state => state.setCurrentConversation)
  const setIsSendingMessage = useConversationStore(state => state.setIsSendingMessage)
  const setCurrentRun = useConversationStore(state => state.setCurrentRun)
  const clearInput = useChatStore((state) => state.clearInput)

  const handleSendMessage = useCallback((payload: SendMessageInput)=>{
    setIsSendingMessage(true)
    sendMessage(payload, {
      onSuccess: (data) => {
        setCurrentConversation(data.conversation)
        const userMsg: Message = {
          id: uuidv4(),
          role: 'user',
          content: [{type: 'text', text: payload.prompt}],
          runId: data.runId,
          createdAt: new Date().toISOString(),
        }
        const run: ConversationRun = {
          runId: data.runId,
          finishReason: 'not-finished',
          error: null,
          messages: [userMsg],
        }
        setCurrentRun(run)
        clearInput()
      },
      onSettled: () => {
        setIsSendingMessage(false)
      }
    })

  }, [sendMessage])

  return handleSendMessage

}

export const useCreateConversation = (projectId: string) => {
  const {mutate: createConversation, isPending: isCreatingConversation} = useMutation(createConversationMutationOptions(projectId))
  const setCurrentConversation = useConversationStore(state => state.setCurrentConversation)

  const handleCreateConversation = useCallback(()=>{
    setCurrentConversation(null)
    createConversation(undefined, {
      onSuccess: (data) => {
        setCurrentConversation(data)
      }
    })
  }, [createConversation])

  return {handleCreateConversation, isCreatingConversation}
}


export const useCancelRequest = () => {

}
