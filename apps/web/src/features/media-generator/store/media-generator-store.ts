import { create } from "zustand"
import { getDefaultSubtype } from "../constants"
import { parseStoredRequest } from "../lib/request-state"
import type { GenerationSubtype, GenerationType } from "../types"

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
  promptSettings: PromptSettings
  viewRequestInput: {
    jobs: Array<Record<string, string>>
    status: "done" | "blocked" | "unknown"
  } | null
}

type StoreActions = {
  appendActiveGenerationRequest: (data: ActiveGenerationRequest) => void
  removeActiveGenerationRequest: (requestId: string) => void
  setGenerationType: (generationType: GenerationType) => void
  setGenerationSubtype: (generationSubtype: GenerationSubtype) => void
  setSelectedModelId: (selectedModelId: string | null) => void
  setParameterValues: (parameterValues: Record<string, string>) => void
  updateParameterValue: (key: string, value: string) => void
  updatePromptSettings: (type: "audio", key: string, value: string) => void
  reset: () => void
  setViewRequestInput: (input: StoreState["viewRequestInput"]) => void
  applyRequestState: (request: Record<string, unknown> | null) => void
}

const initialState: StoreState = {
  activeGenerationRequests: [],
  generationType: "image",
  generationSubtype: getDefaultSubtype("image"),
  selectedModelId: null,
  parameterValues: {},
  promptSettings: {
    audio: { voice: "Kore" },
  },
  viewRequestInput: null,
}

export const useMediaGeneratorStore = create<StoreState & StoreActions>(
  (set) => ({
    ...initialState,
    setGenerationType: (generationType) =>
      set({
        generationType,
        generationSubtype: getDefaultSubtype(generationType),
        selectedModelId: null,
        parameterValues: {},
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
    setViewRequestInput: (input) => set({ viewRequestInput: input }),
    applyRequestState: (request) =>
      set((state) => {
        const parsed = parseStoredRequest(request)
        if (!parsed) return {}

        return {
          generationType: parsed.generationType,
          generationSubtype: parsed.generationSubtype,
          selectedModelId: parsed.selectedModelId,
          parameterValues: parsed.parameterValues,
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
