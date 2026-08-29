import { create } from 'zustand'
import { getDefaultSubtype, showsAgentMode } from '../constants'
import { parseStoredRequest } from '../lib/request-state'
import { defaultAgentParameterValues } from '../lib/agent-settings'
import type { Editor } from '@tiptap/core'
import type { GenerationSubtype, GenerationType, MediaRunMode } from '../types'
import type { AttachedFile } from '@/components/widgets/file-attachments'

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
  viewRequestInput: {
    jobs: Array<Record<string, string>>
    status: 'done' | 'blocked' | 'unknown'
  } | null
  runMode: MediaRunMode
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
  setRunMode: (runMode: MediaRunMode) => void
  applyRequestState: (request: Record<string, unknown> | null) => void
}

const initialState: StoreState = {
  activeGenerationRequests: [],
  generationType: 'image',
  generationSubtype: getDefaultSubtype('image'),
  selectedModelId: null,
  parameterValues: {},
  prompt: '',
  promptSettings: {
    audio: { voice: 'Kore' },
  },
  attachments: [],
  chatInput: null,
  viewRequestInput: null,
  runMode: 'direct',
}

export const useMediaGeneratorStore = create<StoreState & StoreActions>(
  (set) => ({
    ...initialState,
    setPrompt: (data) => set({ prompt: data }),
    setGenerationType: (generationType) =>
      set((state) => {
        const keepAgentMode =
          showsAgentMode(generationType) && state.runMode === 'agent'
        return {
          generationType,
          generationSubtype: getDefaultSubtype(generationType),
          selectedModelId: null,
          parameterValues: keepAgentMode ? defaultAgentParameterValues() : {},
          attachments: [],
          runMode: keepAgentMode ? 'agent' : 'direct',
        }
      }),
    setGenerationSubtype: (generationSubtype) =>
      set((state) => ({
        generationSubtype,
        selectedModelId: null,
        parameterValues:
          state.runMode === 'agent'
            ? defaultAgentParameterValues(state.parameterValues)
            : {},
        attachments: [],
      })),
    setSelectedModelId: (selectedModelId) =>
      set((state) => ({
        selectedModelId,
        parameterValues: state.runMode === 'agent' ? state.parameterValues : {},
      })),
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
    addAttachment: (data) =>
      set((state) => {
        const index = state.attachments.findIndex(
          (attachment) => attachment.id === data.id,
        )
        if (index >= 0) {
          return {
            attachments: state.attachments.map((attachment) =>
              attachment.id === data.id ? data : attachment,
            ),
          }
        }
        return { attachments: [...state.attachments, data] }
      }),
    removeAttachment: (id) =>
      set((state) => ({
        attachments: state.attachments.filter(
          (attachment) => attachment.id !== id,
        ),
      })),
    appendActiveGenerationRequest: (data) =>
      set((state) => ({
        activeGenerationRequests: [data, ...state.activeGenerationRequests],
      })),
    removeActiveGenerationRequest: (requestId) =>
      set((state) => ({
        activeGenerationRequests: state.activeGenerationRequests.filter(
          (request) => request.requestId !== requestId,
        ),
      })),
    reset: () => set(initialState),
    setChatInput: (chatInput) => set({ chatInput }),
    clearChatInput: () =>
      set((state) => {
        if (state.chatInput) {
          state.chatInput.commands.setContent('', { emitUpdate: false })
        }
        return { prompt: '' }
      }),
    setViewRequestInput: (input) => set({ viewRequestInput: input }),
    setRunMode: (runMode) =>
      set((state) => {
        if (runMode === state.runMode) return {}
        if (runMode === 'agent') {
          return {
            runMode,
            parameterValues: defaultAgentParameterValues(state.parameterValues),
          }
        }
        return { runMode, parameterValues: {} }
      }),
    applyRequestState: (request) =>
      set((state) => {
        const parsed = parseStoredRequest(request)
        if (!parsed) return {}

        if (state.chatInput) {
          state.chatInput.commands.setContent(parsed.prompt, {
            emitUpdate: false,
          })
        }

        return {
          generationType: parsed.generationType,
          generationSubtype: parsed.generationSubtype,
          selectedModelId: parsed.selectedModelId,
          parameterValues: parsed.parameterValues,
          prompt: parsed.prompt,
          attachments: parsed.attachments,
          runMode: parsed.runMode,
          promptSettings: parsed.voice
            ? {
                ...state.promptSettings,
                audio: { ...state.promptSettings.audio, voice: parsed.voice },
              }
            : state.promptSettings,
        }
      }),
  }),
)
