import { create } from 'zustand'
import type { Mentions } from '../types'
import { EditorAIBridge } from '../hooks/use-ai-editor-bridge'


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
  ]
}

type ChatState = {
  attachedContext: Mentions
  inputContent: string
  isVoiceRecording: boolean
  editorBridge: EditorAIBridge | null
}


const initialState: ChatState = {
  attachedContext: initialMentions,
  inputContent: '',
  isVoiceRecording: false,
  editorBridge: null,
}

// ============================================================================
// ACTIONS TYPE
// ============================================================================

type ChatActions = {
  setInputContent: (content: string) => void
  appendInputContent: (content: string) => void
  clearInput: () => void
  setVoiceRecording: (recording: boolean) => void
  setEditorBridge: (bridge: EditorAIBridge | null) => void
  reset: () => void
}

// ============================================================================
// STORE
// ============================================================================

export const useChatStore = create<ChatState & ChatActions>((set) => ({
  ...initialState,
  setEditorBridge: (bridge) => set({ editorBridge: bridge }),
  setInputContent: (inputContent) => set({ inputContent }),
  appendInputContent: (content) => set((state) => ({ inputContent: state.inputContent + content })),
  clearInput: () => set((state)=>{
    return { inputContent: '', attachedContext: { ...state.attachedContext, selections: [] } }
  }),
  setVoiceRecording: (recording) => set({ isVoiceRecording: recording }),
  reset: () => set(initialState),
}))
