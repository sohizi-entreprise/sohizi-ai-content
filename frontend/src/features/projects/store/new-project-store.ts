import { create } from 'zustand'

export type NewProjectState = {
    format: string | null
    genre: string | null
    duration: number
    tones: string[]
    audience: string | null
    storyIdea: string
}

type NewProjectActions = {
    setFormat: (format: string) => void
    setGenre: (genre: string) => void
    setDuration: (duration: number) => void
    toggleTone: (tone: string) => void
    setAudience: (audience: string) => void
    setStoryIdea: (storyIdea: string) => void
    reset: () => void
    validate: () => { valid: boolean; errors: string[] }
}

const initialState: NewProjectState = {
    format: null,
    genre: null,
    duration: 5,
    tones: [],
    audience: null,
    storyIdea: '',
}

export const useNewProjectStore = create<NewProjectState & NewProjectActions>((set, get) => ({
    ...initialState,

    setFormat: (format) => set({ format }),
    
    setGenre: (genre) => set({ genre }),
    
    setDuration: (duration) => set({ duration }),
    
    toggleTone: (tone) => set((state) => ({
        tones: state.tones.includes(tone)
            ? state.tones.filter((t) => t !== tone)
            : [...state.tones, tone]
    })),
    
    setAudience: (audience) => set({ audience }),
    
    setStoryIdea: (storyIdea) => set({ storyIdea }),
    
    reset: () => set(initialState),

    validate: () => {
        const state = get()
        const errors: string[] = []

        if (!state.format) {
            errors.push('Please select a format')
        }
        if (!state.genre) {
            errors.push('Please select a genre')
        }
        if (state.tones.length === 0) {
            errors.push('Please select at least one atmospheric tone')
        }
        if (!state.audience) {
            errors.push('Please select a target audience')
        }
        if (!state.storyIdea.trim()) {
            errors.push('Please describe your story idea')
        }

        return {
            valid: errors.length === 0,
            errors,
        }
    },
}))
