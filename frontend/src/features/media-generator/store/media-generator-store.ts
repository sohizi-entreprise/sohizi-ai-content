import { create } from 'zustand'
import { defaultMediaSettings } from '../constants'
import type {
  MediaGenerationSettings,
  MediaType,
} from '../types'
import { AttachedFile } from '@/components/widgets/file-attachments'
import { Editor } from '@tiptap/core'

type ActiveGenerationRequest = {
  requestId: string
  error?: string
}

type StoreState = {
  activeGenerationRequests: Array<ActiveGenerationRequest>
  mediaType: MediaType
  prompt: string
  settings: MediaGenerationSettings
  selectedModelIds: Record<MediaType, string | null>
  attachments: Array<AttachedFile>
  chatInput: Editor | null
  viewRequestInput: {jobs: Record<string, string>[]; status: 'done' | 'blocked' | 'unknown'} | null
}

type StoreActions = {
  appendActiveGenerationRequest: (data: ActiveGenerationRequest) => void
  removeActiveGenerationRequest: (requestId: string) => void
  setMediaType: (mediaType: MediaType) => void
  setPrompt: (prompt: string) => void
  updateSettings: <T extends MediaType>(
    type: T,
    key: string,
    value: string,
  ) => void
  replaceSettings: <T extends MediaType>(
    type: T,
    settings: MediaGenerationSettings[T],
  ) => void
  setSelectedModelId: (type: MediaType, modelId: string | null) => void
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
  settings: defaultMediaSettings,
  selectedModelIds: {
    image: null,
    video: null,
    audio: null,
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
    updateSettings: (type, key, value) =>
      set((state) => ({
        settings: {
          ...state.settings,
          [type]: state.settings[type].map((setting) => setting.key === key ? { ...setting, currentValue: value } : setting),

        },
      })),
    replaceSettings: (type, settings) =>
      set((state) => ({
        settings: {
          ...state.settings,
          [type]: settings,
        },
      })),
    setSelectedModelId: (type, modelId) =>
      set((state) => ({
        selectedModelIds: {
          ...state.selectedModelIds,
          [type]: modelId,
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
