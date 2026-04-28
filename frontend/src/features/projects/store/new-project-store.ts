import { create } from 'zustand'

export type SettingOption = {
    label: string
    value: string
}

export type AdditionalSettings = {
    genre: SettingOption | null
    tone: SettingOption | null
    targetAudience: SettingOption | null
    primaryPlatform: SettingOption | null
    outlineStructure: SettingOption | null
    narrativeStyle: SettingOption | null
    videoAspectRatio: SettingOption | null
    characterStyle: SettingOption | null
}

export type NewProjectState = {
    format: string | null
    duration: string
    storyIdea: string
    additionalSettings: AdditionalSettings
    modelId: string | null
}

type AdditionalSettingKey = keyof AdditionalSettings

type NewProjectActions = {
    setFormat: (format: string) => void
    setDuration: (duration: string) => void
    setStoryIdea: (storyIdea: string) => void
    setAdditionalSetting: (key: AdditionalSettingKey, value: SettingOption) => void
    setModelId: (modelId: string) => void
    reset: () => void
    validate: () => { valid: boolean; errors: string[] }
}

const initialAdditionalSettings: AdditionalSettings = {
    genre: null,
    tone: null,
    targetAudience: null,
    primaryPlatform: null,
    outlineStructure: null,
    narrativeStyle: null,
    videoAspectRatio: null,
    characterStyle: null,
}

const initialState: NewProjectState = {
    format: null,
    duration: '< 2',
    storyIdea: '',
    additionalSettings: initialAdditionalSettings,
    modelId: null,
}

export const useNewProjectStore = create<NewProjectState & NewProjectActions>((set, get) => ({
    ...initialState,

    setFormat: (format) => set({ format }),
    
    setDuration: (duration) => set({ duration }),
    
    setStoryIdea: (storyIdea) => set({ storyIdea }),

    setAdditionalSetting: (key, value) => set((state) => ({
        additionalSettings: {
            ...state.additionalSettings,
            [key]: value,
        }
    })),
    
    reset: () => set(initialState),

    validate: () => {
        const state = get()
        const errors: string[] = []

        if (!state.format) {
            errors.push('Please select a format')
        }
        if (!state.storyIdea.trim()) {
            errors.push('Please describe your story idea')
        }

        return {
            valid: errors.length === 0,
            errors,
        }
    },

    setModelId: (modelId) => set({ modelId }),
}))
