import { create, type StateCreator } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { ChatStreamChunk, Conversation, LlmModel, Message, MsgToolCallPart } from '../types'

// ============================================================================
// INITIAL STATE
// ============================================================================


type ChatState = {
  userPrompt: string
  activeConversation: Conversation | null
  model: LlmModel | null
  pendingMessage: Message | null
  streamingMessages: Message[]
  isStreaming: boolean
}

type ChatActions = {
  setUserPrompt: (content: string) => void
  appendUserPrompt: (content: string) => void
  setModel: (model: LlmModel) => void
  setActiveConversation: (conversation: Conversation) => void
  clearInput: () => void
  reset: () => void
  setPendingMessage: (message: Message | null) => void
  appendChunk: (chunk: ChatStreamChunk) => void
  setIsStreaming: (isStreaming: boolean) => void
  clearStreamingMessages: () => void
}

const initialState: ChatState = {
  userPrompt: '',
  activeConversation: null,
  model: null,
  pendingMessage: null,
  streamingMessages: [],
  isStreaming: false,
}


// ============================================================================
// STORE
// ============================================================================

export const useChatStore = create<ChatState & ChatActions>()(immer((set) => ({
  ...initialState,
  setUserPrompt: (userPrompt) => set({ userPrompt }),
  appendUserPrompt: (content) => set((state) => ({ userPrompt: state.userPrompt + content })),
  setModel: (model) => set({ model }),
  setActiveConversation: (conversation) => set({ activeConversation: conversation }),
  clearInput: () => set({ userPrompt: '' }),
  reset: () => set(initialState),
  setPendingMessage: (message) => set({ pendingMessage: message }),
  setIsStreaming: (isStreaming) => set({ isStreaming }),
  clearStreamingMessages: () => set({ streamingMessages: [] }),
  appendChunk: (chunk) => set((state) => {
    if (!chunk.runId) return

    let message = state.streamingMessages.find((streamingMessage) => streamingMessage.id === chunk.runId)
    if (!message) {
      message = {
        id: chunk.runId,
        role: 'assistant',
        content: [],
        createdAt: new Date().toISOString(),
      }
      state.streamingMessages.push(message)
    }

    switch (chunk.type) {
      case 'text_delta': {
        const textPart = message.content.find((part) => part.type === 'text')
        if (textPart) {
          textPart.text += chunk.text
        } else {
          message.content.push({ type: 'text', text: chunk.text })
        }
        break
      }
  
      case 'reasoning_delta':{
        const reasoningPart = message.content.find((part) => part.type === 'reasoning')
        if (reasoningPart) {
          reasoningPart.text += chunk.text
        } else {
          message.content.push({ type: 'reasoning', text: chunk.text })
        }
        break
      }
      case 'usage':
        console.log('usage', chunk)
        break
      case 'tool_call_start':{
        const toolCallPart = message.content.find((part) => part.type === 'tool-call' && part.toolCallId === chunk.toolCallId) as MsgToolCallPart | undefined
        if (toolCallPart) {
          toolCallPart.input = `${toolCallPart.input ?? ''}${chunk.input}`
        } else {
          message.content.push({ type: 'tool-call', toolCallId: chunk.toolCallId, toolName: chunk.toolName, input: chunk.input, isStreaming: true })
        }
        break
      }
      case 'tool_call_delta':{
        const toolCallPart = message.content.find((part) => part.type === 'tool-call' && part.toolCallId === chunk.toolCallId) as MsgToolCallPart | undefined
        if (toolCallPart) {
          toolCallPart.input = `${toolCallPart.input ?? ''}${chunk.input}`
        } 
        break
      }
      case 'tool_call_end':{
        const toolCallPart = message.content.find((part) => part.type === 'tool-call' && part.toolCallId === chunk.toolCallId) as MsgToolCallPart | undefined
        if (toolCallPart) {
          toolCallPart.isStreaming = false
        }
        break
      }
      case 'tool_call':{
        // TODO: Work with the tool call
        break
      }
      case 'complete':{
        // TODO: Work with the complete
        break
      }
      case 'error':{
        console.error('error', chunk)
        break
      }

      case 'abort':{
        console.log('Aborted')
        break
      }

      case 'identifier':{
        // set({ activeConversationId: chunk.conversationId })
        break
      }
    }
  })
})) as StateCreator<ChatState & ChatActions>)
