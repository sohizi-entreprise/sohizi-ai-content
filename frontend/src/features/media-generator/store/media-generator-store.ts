import { create } from 'zustand'
import type {
  ComposerMediaType,
} from '../types'
import { AttachedFile } from '@/components/widgets/file-attachments'
import { Editor } from '@tiptap/core'

type ActiveGenerationRequest = {
  requestId: string
  error?: string
}

type PromptSettings = {
  image: Record<string, string>
  video: Record<string, string>
  audio: Record<string, string>
}

type StoreState = {
  activeGenerationRequests: Array<ActiveGenerationRequest>
  mediaType: ComposerMediaType
  prompt: string
  promptSettings: PromptSettings
  attachments: Array<AttachedFile>
  chatInput: Editor | null
  viewRequestInput: {jobs: Record<string, string>[]; status: 'done' | 'blocked' | 'unknown'} | null
}

type StoreActions = {
  appendActiveGenerationRequest: (data: ActiveGenerationRequest) => void
  removeActiveGenerationRequest: (requestId: string) => void
  setMediaType: (mediaType: ComposerMediaType) => void
  setPrompt: (prompt: string) => void
  updatePromptSettings: <T extends ComposerMediaType>(
    type: T,
    key: string,
    value: string,
  ) => void
  addAttachment: (attachment: AttachedFile) => void
  removeAttachment: (id: string) => void
  reset: () => void
  setChatInput: (chatInput: Editor | null) => void
  clearChatInput: () => void
  setViewRequestInput: (input: StoreState['viewRequestInput']) => void
}

const initialState: StoreState = {
  activeGenerationRequests: [],
  mediaType: 'image',
  prompt: '',
  promptSettings: {
    image: {},
    video: {},
    audio: {voice: 'Kore'},
  },
  attachments: [],
  chatInput: null,
  viewRequestInput: null,
}


export const useMediaGeneratorStore = create<StoreState & StoreActions>(
  (set, _get) => ({
    ...initialState,
    setPrompt: (data) => set({ prompt: data }),
    setMediaType: (data) => set({ mediaType: data }),
    updatePromptSettings: (type, key, value) =>
      set((state) => ({
        promptSettings: {
          ...state.promptSettings,
          [type]: { ...state.promptSettings[type], [key]: value },
        },
      })),
    addAttachment: (data) => set((state) => {
      const index = state.attachments.findIndex((attachment) => attachment.id === data.id)
      if (index >= 0) {
        return { 
          attachments: state.attachments.map((attachment) => attachment.id === data.id ? data : attachment) 
        }
      }
      return { attachments: [...state.attachments, data] }
    }),
    removeAttachment: (id) => set((state) => ({ attachments: state.attachments.filter((attachment) => attachment.id !== id) })),
    appendActiveGenerationRequest: (data) => set((state) => ({ activeGenerationRequests: [data, ...state.activeGenerationRequests] })),
    removeActiveGenerationRequest: (requestId) => set((state) => ({ activeGenerationRequests: state.activeGenerationRequests.filter((request) => request.requestId !== requestId) })),
    reset: () => set(initialState),
    setChatInput: (chatInput) => set({ chatInput }),
    clearChatInput: () => set(state => {
      if (state.chatInput) {
        state.chatInput.commands.setContent('', {emitUpdate: false})
      }
      return {prompt: ''}
    }),
    setViewRequestInput: (input) => set({ viewRequestInput: input }),
  }),
)
