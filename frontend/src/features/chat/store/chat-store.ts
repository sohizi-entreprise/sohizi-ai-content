import { create, type StateCreator } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { ChatStreamChunk, Conversation, LlmModel, Message } from '../types'
import { applyChunkToStreamingMessages } from './apply-chunk'

// ============================================================================
// INITIAL STATE
// ============================================================================

export type AttachedFile = {
  status: 'pending'
  id: string
  type: string
  preview?: string
} | {
  status: 'uploaded'
  id: string
  type: string
  preview?: string
  url: string
} | {
  status: 'failed'
  id: string
  type: string
  preview?: string
  error: string
}

type AttachedFileUpdate =
  | Partial<Omit<Extract<AttachedFile, { status: 'pending' }>, 'id'>>
  | Omit<Extract<AttachedFile, { status: 'uploaded' }>, 'id'>
  | Omit<Extract<AttachedFile, { status: 'failed' }>, 'id'>

type ChatState = {
  userPrompt: string
  activeConversation: Conversation | null
  model: LlmModel | null
  pendingMessage: Message | null
  streamingMessages: Message[]
  isStreaming: boolean
  attachedFiles: AttachedFile[]
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
  appendChunks: (chunks: ChatStreamChunk[]) => void
  setIsStreaming: (isStreaming: boolean) => void
  clearStreamingMessages: () => void
  addAttachedFile: (file: AttachedFile) => void
  removeAttachedFile: (id: string) => void
  updateAttachedFile: (id: string, file: AttachedFileUpdate) => void
}

const initialState: ChatState = {
  userPrompt: '',
  activeConversation: null,
  model: null,
  pendingMessage: null,
  streamingMessages: [],
  isStreaming: false,
  attachedFiles: [],
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
  addAttachedFile: (file) => set((state) => {
    const index = state.attachedFiles.findIndex((f) => f.id === file.id)

    if (index >= 0) {
      state.attachedFiles[index] = file
      return
    }
    state.attachedFiles.push(file)
  }),
  updateAttachedFile: (id, file) => set((state) => {
    const index = state.attachedFiles.findIndex((f) => f.id === id)
    if (index < 0) return

    const currentFile = state.attachedFiles[index]
    state.attachedFiles[index] = { ...currentFile, ...file } as AttachedFile
  }),
  removeAttachedFile: (id) => set((state) => {
    state.attachedFiles = state.attachedFiles.filter((file) => file.id !== id)
  }),
  appendChunk: (chunk) => set((state) => {
    applyChunkToStreamingMessages(state.streamingMessages, chunk)
  }),
  appendChunks: (chunks) => set((state) => {
    for (const chunk of chunks) {
      applyChunkToStreamingMessages(state.streamingMessages, chunk)
    }
  }),
})) as StateCreator<ChatState & ChatActions>)
