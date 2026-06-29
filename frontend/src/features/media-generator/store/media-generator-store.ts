import { create } from 'zustand'
import { defaultMediaSettings } from '../constants'
import type {
  MediaGenerationSettings,
  MediaType,
} from '../types'
import { AttachedFile } from '@/components/widgets/file-attachments'

type ActiveGenerationRequest = {
  requestId: string
  error?: string
}

type StoreState = {
  activeGenerationRequests: Array<ActiveGenerationRequest>
  mediaType: MediaType
  prompt: string
  settings: MediaGenerationSettings
  attachments: Array<AttachedFile>
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
  addAttachment: (attachment: AttachedFile) => void
  removeAttachment: (id: string) => void
  reset: () => void
}

const initialState: StoreState = {
  activeGenerationRequests: [],
  mediaType: 'image',
  prompt: '',
  settings: defaultMediaSettings,
  attachments: [],
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
    appendActiveGenerationRequest: (data) => set((state) => ({ activeGenerationRequests: [...state.activeGenerationRequests, data] })),
    removeActiveGenerationRequest: (requestId) => set((state) => ({ activeGenerationRequests: state.activeGenerationRequests.filter((request) => request.requestId !== requestId) })),
    reset: () => set(initialState),
  }),
)
