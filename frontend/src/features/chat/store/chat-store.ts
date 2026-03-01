import { create } from 'zustand'
import type {
  ChatState,
  ChatUIState,
  Conversation,
  Message,
  EditorType,
  SelectionContext,
  Mentions
} from '../types'

// ============================================================================
// SELECTION REMOVAL SUBSCRIBERS
// ============================================================================

type SelectionRemovalCallback = (anchorId: string) => void
const selectionRemovalSubscribers = new Set<SelectionRemovalCallback>()

/**
 * Subscribe to selection removal events
 * Returns an unsubscribe function
 */
export function subscribeToSelectionRemoval(callback: SelectionRemovalCallback): () => void {
  selectionRemovalSubscribers.add(callback)
  return () => {
    selectionRemovalSubscribers.delete(callback)
  }
}

/**
 * Notify all subscribers that a selection was removed
 */
function notifySelectionRemoval(anchorId: string): void {
  selectionRemovalSubscribers.forEach((callback) => callback(anchorId))
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialMentions: Mentions = {
  characters: [
    { id: '1', display: 'John Doe' },
    { id: '2', display: 'Jane Doe' },
    { id: '3', display: 'Jim Beam' },
  ],
  locations: [
    { id: '1', display: 'New York' },
    { id: '2', display: 'Los Angeles' },
    { id: '3', display: 'Chicago' },
  ],
  selections: [],
}

const initialUIState: ChatUIState = {
  isInputFocused: false,
  isMentionPopoverOpen: false,
  mentionQuery: '',
  isHistoryOpen: false,
  isVoiceRecording: false,
}

const initialState: ChatState = {
  currentConversation: null,
  messages: [],
  attachedContext: initialMentions,
  inputContent: '',
  ui: initialUIState,
  isLoading: false,
  isSending: false,
  isStreaming: false,
  error: null,
}

// ============================================================================
// ACTIONS TYPE
// ============================================================================

type ChatActions = {
  // Conversation actions
  setCurrentConversation: (conversation: Conversation | null) => void
  createNewConversation: (projectId: string, editorType: EditorType) => void
  
  // Message actions
  setMessages: (messages: Message[]) => void
  addMessage: (message: Message) => void
  updateMessage: (id: string, updates: Partial<Message>) => void
  appendToStreamingMessage: (id: string, content: string) => void
  clearMessages: () => void
  
  // Context actions
  addSelectionContext: (context: SelectionContext) => void
  removeSelectionContext: (id: string) => void
  
  // Input actions
  setInputContent: (content: string) => void
  clearInput: () => void
  
  // UI actions
  setInputFocused: (focused: boolean) => void
  toggleHistory: () => void
  setHistoryOpen: (open: boolean) => void
  setVoiceRecording: (recording: boolean) => void
  
  // Loading state actions
  setLoading: (loading: boolean) => void
  setSending: (sending: boolean) => void
  setStreaming: (streaming: boolean) => void
  
  // Error actions
  setError: (error: string | null) => void
  clearError: () => void
  
  // Reset
  reset: () => void
}

// ============================================================================
// STORE
// ============================================================================

export const useChatStore = create<ChatState & ChatActions>((set) => ({
  ...initialState,

  // -------------------------------------------------------------------------
  // Conversation actions
  // -------------------------------------------------------------------------

  setCurrentConversation: (conversation) => set({ 
    currentConversation: conversation,
    messages: [],
    error: null,
  }),

  createNewConversation: (projectId, editorType) => {
    const newConversation: Conversation = {
      id: crypto.randomUUID(),
      projectId,
      title: 'New Chat',
      editorType,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    set({
      currentConversation: newConversation,
      messages: [],
      attachedContext: initialMentions,
      inputContent: '',
      error: null,
    })
  },

  // -------------------------------------------------------------------------
  // Message actions
  // -------------------------------------------------------------------------

  setMessages: (messages) => set({ messages }),

  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message],
  })),

  updateMessage: (id, updates) => set((state) => ({
    messages: state.messages.map((msg) =>
      msg.id === id ? { ...msg, ...updates } : msg
    ),
  })),

  appendToStreamingMessage: (id, content) => set((state) => ({
    messages: state.messages.map((msg) =>
      msg.id === id ? { ...msg, content: msg.content + content } : msg
    ),
  })),

  clearMessages: () => set({ messages: [] }),

  // -------------------------------------------------------------------------
  // Input actions
  // -------------------------------------------------------------------------

  setInputContent: (inputContent) => set({ inputContent }),
  addSelectionContext: (context) => set((state) => ({
    attachedContext: { ...state.attachedContext, selections: [...state.attachedContext.selections, context] },
  })),

  removeSelectionContext: (id) => {
    // Notify subscribers before removing
    notifySelectionRemoval(id)
    set((state) => ({
      attachedContext: { ...state.attachedContext, selections: state.attachedContext.selections.filter((c) => c.id !== id) },
    }))
  },

  clearInput: () => set({ inputContent: '', attachedContext: initialMentions }),

  // -------------------------------------------------------------------------
  // UI actions
  // -------------------------------------------------------------------------

  setInputFocused: (focused) => set((state) => ({
    ui: { ...state.ui, isInputFocused: focused },
  })),

  toggleHistory: () => set((state) => ({
    ui: { ...state.ui, isHistoryOpen: !state.ui.isHistoryOpen },
  })),

  setHistoryOpen: (open) => set((state) => ({
    ui: { ...state.ui, isHistoryOpen: open },
  })),

  setVoiceRecording: (recording) => set((state) => ({
    ui: { ...state.ui, isVoiceRecording: recording },
  })),

  // -------------------------------------------------------------------------
  // Loading state actions
  // -------------------------------------------------------------------------

  setLoading: (isLoading) => set({ isLoading }),
  setSending: (isSending) => set({ isSending }),
  setStreaming: (isStreaming) => set({ isStreaming }),

  // -------------------------------------------------------------------------
  // Error actions
  // -------------------------------------------------------------------------

  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),

  // -------------------------------------------------------------------------
  // Reset
  // -------------------------------------------------------------------------

  reset: () => set(initialState),
}))
