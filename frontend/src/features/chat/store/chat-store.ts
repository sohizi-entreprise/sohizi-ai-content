import { create } from 'zustand'
import type {
  ChatState,
  ChatUIState,
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
  mentionQuery: '',
  isVoiceRecording: false,
}

const initialState: ChatState = {
  attachedContext: initialMentions,
  inputContent: '',
  ui: initialUIState,
}

// ============================================================================
// ACTIONS TYPE
// ============================================================================

type ChatActions = {
  
  // Context actions
  addSelectionContext: (context: SelectionContext) => void
  removeSelectionContext: (id: string) => void
  
  // Input actions
  setInputContent: (content: string) => void
  clearInput: () => void
  
  // UI actions
  setInputFocused: (focused: boolean) => void
  setVoiceRecording: (recording: boolean) => void
  
  // Reset
  reset: () => void
}

// ============================================================================
// STORE
// ============================================================================

export const useChatStore = create<ChatState & ChatActions>((set) => ({
  ...initialState,

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

  clearInput: () => set((state)=>{
    for(const selection of state.attachedContext.selections){
      notifySelectionRemoval(selection.id)
    }
    return { inputContent: '', attachedContext: { ...state.attachedContext, selections: [] } }
  }),

  // -------------------------------------------------------------------------
  // UI actions
  // -------------------------------------------------------------------------

  setInputFocused: (focused) => set((state) => ({
    ui: { ...state.ui, isInputFocused: focused },
  })),

  setVoiceRecording: (recording) => set((state) => ({
    ui: { ...state.ui, isVoiceRecording: recording },
  })),

  // -------------------------------------------------------------------------
  // Reset
  // -------------------------------------------------------------------------

  reset: () => set(initialState),
}))
