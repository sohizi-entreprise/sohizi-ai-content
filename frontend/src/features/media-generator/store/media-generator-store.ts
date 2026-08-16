import { create } from 'zustand'
import type { GenerationSubtype, GenerationType } from '../types'
import { getDefaultSubtype } from '../constants'
import { AttachedFile } from '@/components/widgets/file-attachments'
import { Editor } from '@tiptap/core'

type ActiveGenerationRequest = {
  requestId: string
  error?: string
}

type PromptSettings = {
  audio: Record<string, string>
}

type StoreState = {
  activeGenerationRequests: Array<ActiveGenerationRequest>
  generationType: GenerationType
  generationSubtype: GenerationSubtype | null
  selectedModelId: string | null
  parameterValues: Record<string, string>
  prompt: string
  promptSettings: PromptSettings
  attachments: Array<AttachedFile>
  chatInput: Editor | null
  viewRequestInput: {jobs: Record<string, string>[]; status: 'done' | 'blocked' | 'unknown'} | null
}

type StoreActions = {
  appendActiveGenerationRequest: (data: ActiveGenerationRequest) => void
  removeActiveGenerationRequest: (requestId: string) => void
  setGenerationType: (generationType: GenerationType) => void
  setGenerationSubtype: (generationSubtype: GenerationSubtype) => void
  setSelectedModelId: (selectedModelId: string | null) => void
  setParameterValues: (parameterValues: Record<string, string>) => void
  updateParameterValue: (key: string, value: string) => void
  setPrompt: (prompt: string) => void
  updatePromptSettings: (type: 'audio', key: string, value: string) => void
  addAttachment: (attachment: AttachedFile) => void
  removeAttachment: (id: string) => void
  reset: () => void
  setChatInput: (chatInput: Editor | null) => void
  clearChatInput: () => void
  setViewRequestInput: (input: StoreState['viewRequestInput']) => void
}

const initialState: StoreState = {
  activeGenerationRequests: [],
  generationType: 'image',
  generationSubtype: null,
  selectedModelId: null,
  parameterValues: {},
  prompt: '',
  promptSettings: {
    audio: {voice: 'Kore'},
  },
  attachments: [],
  chatInput: null,
  viewRequestInput: null,
}


export const useMediaGeneratorStore = create<StoreState & StoreActions>(
  (set) => ({
    ...initialState,
    setPrompt: (data) => set({ prompt: data }),
    setGenerationType: (generationType) =>
      set({
        generationType,
        generationSubtype: getDefaultSubtype(generationType),
        selectedModelId: null,
        parameterValues: {},
        attachments: [],
      }),
    setGenerationSubtype: (generationSubtype) =>
      set({
        generationSubtype,
        selectedModelId: null,
        parameterValues: {},
      }),
    setSelectedModelId: (selectedModelId) =>
      set({
        selectedModelId,
        parameterValues: {},
      }),
    setParameterValues: (parameterValues) => set({ parameterValues }),
    updateParameterValue: (key, value) =>
      set((state) => ({
        parameterValues: { ...state.parameterValues, [key]: value },
      })),
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
