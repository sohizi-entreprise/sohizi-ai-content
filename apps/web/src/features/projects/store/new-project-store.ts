import { create } from "zustand"

export type SettingOption = {
  label: string
  value: string
}

export type AdditionalSettings = {
  format: SettingOption | null
  genre: SettingOption | null
  tone: SettingOption | null
  targetAudience: SettingOption | null
  primaryPlatform: SettingOption | null
  outlineStructure: SettingOption | null
  narrativeStyle: SettingOption | null
  videoAspectRatio: SettingOption | null
  characterStyle: SettingOption | null
}

export type ProjectAttachment = {
  id: string
  name: string
  type: string
  preview?: string
  file: File
}

export type NewProjectState = {
  duration: string
  storyIdea: string
  additionalSettings: AdditionalSettings
  modelId: string | null
  reasoningEffortByModelId: Record<string, string>
  commandId: string | null
  attachments: Array<ProjectAttachment>
}

export type AdditionalSettingKey = keyof AdditionalSettings

type NewProjectActions = {
  setDuration: (duration: string) => void
  setStoryIdea: (storyIdea: string) => void
  setAdditionalSetting: (
    key: AdditionalSettingKey,
    value: SettingOption,
  ) => void
  clearAdditionalSetting: (key: AdditionalSettingKey) => void
  setModelId: (modelId: string) => void
  setReasoningEffort: (modelId: string, reasoningEffort: string) => void
  setCommandId: (commandId: string) => void
  addAttachments: (attachments: Array<ProjectAttachment>) => void
  removeAttachment: (id: string) => void
  reset: () => void
  validate: () => { valid: boolean; errors: Array<string> }
}

const initialAdditionalSettings: AdditionalSettings = {
  format: null,
  genre: null,
  tone: null,
  targetAudience: null,
  primaryPlatform: null,
  outlineStructure: null,
  narrativeStyle: null,
  videoAspectRatio: null,
  characterStyle: null,
}

export const isAdditionalSettingKey = (
  key: string,
): key is AdditionalSettingKey =>
  Object.prototype.hasOwnProperty.call(initialAdditionalSettings, key)

const initialState: NewProjectState = {
  duration: "< 2",
  storyIdea: "",
  additionalSettings: initialAdditionalSettings,
  modelId: null,
  reasoningEffortByModelId: {},
  commandId: null,
  attachments: [],
}

export const useNewProjectStore = create<NewProjectState & NewProjectActions>(
  (set, get) => ({
    ...initialState,

    setDuration: (duration) => set({ duration }),

    setStoryIdea: (storyIdea) => set({ storyIdea }),

    setAdditionalSetting: (key, value) =>
      set((state) => ({
        additionalSettings: {
          ...state.additionalSettings,
          [key]: value,
        },
      })),

    clearAdditionalSetting: (key) =>
      set((state) => ({
        additionalSettings: {
          ...state.additionalSettings,
          [key]: null,
        },
      })),

    setCommandId: (commandId) => set({ commandId }),

    addAttachments: (attachments) =>
      set((state) => ({
        attachments: [...state.attachments, ...attachments],
      })),

    removeAttachment: (id) =>
      set((state) => ({
        attachments: state.attachments.filter(
          (attachment) => attachment.id !== id,
        ),
      })),

    reset: () => set(initialState),

    validate: () => {
      const state = get()
      const errors: Array<string> = []

      if (!state.additionalSettings.format) {
        errors.push("Please select a format")
      }
      if (!state.storyIdea.trim()) {
        errors.push("Please describe your story idea")
      }

      return {
        valid: errors.length === 0,
        errors,
      }
    },

    setModelId: (modelId) => set({ modelId }),

    setReasoningEffort: (modelId, reasoningEffort) =>
      set((state) => ({
        reasoningEffortByModelId: {
          ...state.reasoningEffortByModelId,
          [modelId]: reasoningEffort,
        },
      })),
  }),
)
