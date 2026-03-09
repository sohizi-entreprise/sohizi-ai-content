import { create } from 'zustand'
import { Conversation, ConversationRun } from '../types'

type ConversationState = {
  currentConversation: Conversation | null
  currentRun: ConversationRun | null
  runs: ConversationRun[]
  isHistoryOpen: boolean
  isSendingMessage: boolean
  isStreaming: boolean
}

type ConversationActions = {
  setCurrentConversation: (conversation: Conversation | null) => void
  setCurrentRun: (run: ConversationRun | null) => void
  setRuns: (runs: ConversationRun[]) => void
  appendRun: (run: ConversationRun) => void
  sendMessage: () => void
  toggleHistory: (value?: boolean) => void
  setIsSendingMessage: (isSending: boolean) => void
  setIsStreaming: (isStreaming: boolean) => void
  updateReasoningChunk: (data: {runId: string, stepId: string, text: string}) => void
  updateTextChunk: (data: {runId: string, stepId: string, text: string}) => void
  updateToolCallChunk: (data: {runId: string, stepId: string, toolName: string, toolId: string, args: unknown}) => void
  updateWritingChunk: (data: {runId: string, stepId: string, text: string}) => void
}


const initialState: ConversationState = {
  currentConversation: null,
  currentRun: null,
  runs: [],
  isHistoryOpen: false,
  isSendingMessage: false,
  isStreaming: false,
}

export const useConversationStore = create<ConversationState & ConversationActions>((set) => ({
  ...initialState,
  setCurrentConversation: (conversation) => set({ currentConversation: conversation }),
  setCurrentRun: (run) => set({ currentRun: run }),
  setRuns: (runs) => set({ runs }),
  appendRun: (run) => set((state) => ({ runs: [...state.runs, run] })),
  sendMessage: () => {},
  toggleHistory: (value) => set((state) => ({ isHistoryOpen: value !== undefined ? value : !state.isHistoryOpen })),
  setIsSendingMessage: (isSending) => set({ isSendingMessage: isSending }),
  setIsStreaming: (isStreaming) => set({ isStreaming: isStreaming }),

  updateReasoningChunk: (data) => set((state) => {
    if(!state.currentRun || state.currentRun.runId !== data.runId) return state
    const message = state.currentRun.messages.find(msg => msg.id === data.stepId)
    if(!message){
        const newMessage = {
            id: data.stepId,
            role: 'assistant' as const,
            content: [],
            runId: data.runId,
            metadata: {
                reasoningText: data.text,
            },
            createdAt: new Date().toISOString(),
        }
        return {currentRun: {
            ...state.currentRun,
            messages: [...state.currentRun.messages, newMessage],
        }}
    }
    const currentText = message.metadata?.reasoningText || ''
    const newMessage = {
        ...message,
        metadata: {
            ...(message.metadata || {}),
            reasoningText: currentText + data.text,
        },
    }
    return {currentRun: {
        ...state.currentRun,
        messages: state.currentRun.messages.map(msg => msg.id === data.stepId ? newMessage : msg),
    }}
  }),

  updateTextChunk: (data) => set((state) => {
    if(!state.currentRun || state.currentRun.runId !== data.runId) return state
    const message = state.currentRun.messages.find(msg => msg.id === data.stepId)
    if(!message){
        const newMessage = {
            id: data.stepId,
            role: 'assistant' as const,
            content: [{type: 'text' as const, text: data.text}],
            runId: data.runId,
            createdAt: new Date().toISOString(),
        }
        return {currentRun: {
            ...state.currentRun,
            messages: [...state.currentRun.messages, newMessage],
        }}
    }
    const textPart = message.content.find(part => part.type === 'text')
    const currentText = textPart?.text ?? ''
    const newText = currentText + data.text
    // If reasoning created the message first, content may be [] — we must add a text part
    const newContent = textPart
      ? message.content.map(part => part.type === 'text' ? { ...part, text: newText } : part)
      : [...message.content, { type: 'text' as const, text: newText }]
    const newMessage = {
      ...message,
      content: newContent,
    }
    return {currentRun: {
        ...state.currentRun,
        messages: state.currentRun.messages.map(msg => msg.id === data.stepId ? newMessage : msg),
    }}
  }),

  updateToolCallChunk: (data) => set((state) => {
    if(!state.currentRun || state.currentRun.runId !== data.runId) return state
    const message = state.currentRun.messages.find(msg => msg.id === data.stepId)
    const toolContent = {
        type: 'tool-call' as const,
        toolName: data.toolName,
        toolCallId: data.toolId,
        input: data.args,
    }
    if(!message){
        const newMessage = {
            id: data.stepId,
            role: 'assistant' as const,
            content: [toolContent],
            runId: data.runId,
            createdAt: new Date().toISOString(),
        }
        return {currentRun: {
            ...state.currentRun,
            messages: [...state.currentRun.messages, newMessage],
        }}
    }
    
    const newMessage = {
        ...message,
        content: message.content.map(part => part.type === 'tool-call' ? toolContent : part),
        
    }
    return {currentRun: {
        ...state.currentRun,
        messages: state.currentRun.messages.map(msg => msg.id === data.stepId ? newMessage : msg),
    }}
  }),

  updateWritingChunk: (data) => set((state) => {
    if(!state.currentRun || state.currentRun.runId !== data.runId) return state
    const message = state.currentRun.messages.find(msg => msg.id === data.stepId)
    
    if(!message){
        const newMessage = {
            id: data.stepId,
            role: 'tool' as const,
            content: [{
                type: 'tool-result' as const,
                toolName: 'write-content',
                toolCallId: data.stepId,
                output: {type: 'text' as const, value: data.text},
            }],
            runId: data.runId,
            createdAt: new Date().toISOString(),
        }
        return {currentRun: {
            ...state.currentRun,
            messages: [...state.currentRun.messages, newMessage],
        }}
    }
    
    const newMessage = {
        ...message,
        content: message.content.map(part => part.type === 'tool-result' ? {...part, output: {type: 'text' as const, value: (part.output?.value || '') + data.text}} : part),
    }
    return {currentRun: {
        ...state.currentRun,
        messages: state.currentRun.messages.map(msg => msg.id === data.stepId ? newMessage : msg),
    }}
  }),

}))