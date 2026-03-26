import { create } from 'zustand'
import { parse as parsePartialJson } from 'partial-json'
import type { JSONContent } from '@tiptap/core'
import { DeltaData, ErrorData } from '../event-handlers'

// ============================================================================
// TYPES
// ============================================================================

export type SceneOutline = {
    scene_number: number
    slugline: string
    characters_present: string[]
    scene_goal: string
    action_summary: string
}

export type Beat = {
    beat_name: string
    summary: string
    scenes: SceneOutline[]
}

export type ScriptOutline = {
    beats: Beat[]
}

export type StoryBibleOutline = {
    world: {
        setting: string
        timePeriod: string
        worldRules: string
        socialContext: string
    }
    conflictEngine: {
        centralConflict: string
        stakes: string
        antagonisticForce: string
        timePressure: string
        mainDramaticQuestion: string
    }
    keyLocations: {
        name: string
        description: string
        significance: string
    }[]
    keyCharacters: {
        name: string
        role: 'protagonist' | 'antagonist' | 'supporting'
        age: number
        goal: string
    }[]
    toneAndStyle: {
        visualStyle: string
        dialogueStyle: string
        pacing: string
    }
    continuityRules: {
        factsToConsistent: string
        characterBehaviorRules: string
        worldLogicRules: string
        thingsToAvoid: string
    }
}

export type Character = {
    name: string
    role: 'protagonist' | 'antagonist' | 'supporting' | 'minor'
    age: number
    occupation: string
    physicalDescription: string
    personalityTraits: string[]
    backstory: string
    motivation: string
    flaw: string
    voice: string
}

export type Location = {
    name: string
    description: string
}

export type Prop = {
    name: string
    description: string
}

export type Entities = {
    characters: Character[]
    locations: Location[]
    props: Prop[]
}

export type StreamingComponentType = 
    | 'storyBible' 
    | 'character' 
    | 'script' 
    | 'scene'

export type GeneratingState = Record<StreamingComponentType, boolean>

export type GenerationErrors = Record<StreamingComponentType, string | null>

export type GenerationReasoning = Record<StreamingComponentType, string | null>

type StreamBuffers = Record<StreamingComponentType, {
    content: string
    reasoning: string
}>

export type StartEventName = 
    | 'story_bible_start' 
    | 'character_start' 
    | 'script_start' 
    | 'scene_start'

export type EndEventName = 
    | 'story_bible_end' 
    | 'character_end' 
    | 'script_end' 
    | 'scene_end'

export type DeltaEventName =
    | 'story_bible_delta'
    | 'character_delta'
    | 'script_delta'
    | 'scene_delta'

export type ErrorEventName =
    | 'story_bible_error'
    | 'character_error'
    | 'script_error'
    | 'scene_error'

export type ScriptStreamEventName =
    | StartEventName
    | EndEventName
    | DeltaEventName
    | ErrorEventName
    | 'error'

export type ScriptStreamEvent<T = unknown> = {
    id?: string
    event: ScriptStreamEventName
    data: T
}

const startEventToComponentType: Record<StartEventName, StreamingComponentType> = {
    story_bible_start: 'storyBible',
    character_start: 'character',
    script_start: 'script',
    scene_start: 'scene',
}

const endEventToComponentType: Record<EndEventName, StreamingComponentType> = {
    story_bible_end: 'storyBible',
    character_end: 'character',
    script_end: 'script',
    scene_end: 'scene',
}

const deltaEventToComponentType: Record<DeltaEventName, StreamingComponentType> = {
    story_bible_delta: 'storyBible',
    character_delta: 'character',
    script_delta: 'script',
    scene_delta: 'scene',
}

const errorEventToComponentType: Record<ErrorEventName, StreamingComponentType> = {
    story_bible_error: 'storyBible',
    character_error: 'character',
    script_error: 'script',
    scene_error: 'scene',
}

const defaultErrorMessages: Record<StreamingComponentType, string> = {
    storyBible: 'Story bible generation failed',
    character: 'Character generation failed',
    script: 'Script outline generation failed',
    scene: 'Scene generation failed',
}

type ShowLayersState = {
    entities: boolean
    scenes: boolean
}

// ============================================================================
// STATE TYPE
// ============================================================================

export type ScriptState = {
    projectId: string | null
    
    storyBibleOutline: Partial<StoryBibleOutline> | null
    scriptOutline: Partial<ScriptOutline> | null
    scenes: JSONContent | null
    entities: Entities
    
    isGenerating: GeneratingState
    errors: GenerationErrors
    reasoning: GenerationReasoning
    _buffers: StreamBuffers

    showLayers: ShowLayersState
    openChat: boolean
}

type ScriptActions = {
    initialize: (projectId: string, data?: {
        storyBibleOutline?: StoryBibleOutline | null
        scriptOutline?: ScriptOutline | null
        scenes?: JSONContent | null
        entities?: Partial<Entities>
    }) => void
    reset: () => void
    
    setStoryBibleOutline: (outline: StoryBibleOutline | null) => void
    setScriptOutline: (outline: ScriptOutline | null) => void
    setScenes: (scenes: JSONContent | null) => void
    setEntities: (entities: Partial<Entities>) => void
    addCharacter: (character: Character) => void
    addLocation: (location: Location) => void
    addProp: (prop: Prop) => void
    
    setIsGenerating: (type: StreamingComponentType, isGenerating: boolean) => void
    setError: (type: StreamingComponentType, error: string | null) => void
    setReasoning: (type: StreamingComponentType, reasoning: string | null) => void
    clearErrors: () => void
    clearReasoning: () => void
    setShowLayers: (type: keyof ShowLayersState, show: boolean) => void
    toggleLayer: (type: keyof ShowLayersState) => void
    toggleChat: () => void

    handleStreamEvent: (event: ScriptStreamEvent<unknown>) => void
    handleEventStart: (eventName: StartEventName) => void
    handleEventEnd: (eventName: EndEventName) => void
    handleEventDelta: (eventName: DeltaEventName, data: DeltaData) => void
    handleEventError: (eventName: ErrorEventName, data: ErrorData) => void
    
    handleStoryBibleDelta: (data: DeltaData) => void
    handleCharacterDelta: (data: DeltaData) => void
    handleScriptDelta: (data: DeltaData) => void
    handleSceneDelta: (data: DeltaData) => void
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialGenerating: GeneratingState = {
    storyBible: false,
    character: false,
    script: false,
    scene: false,
}

const initialErrors: GenerationErrors = {
    storyBible: null,
    character: null,
    script: null,
    scene: null,
}

const initialReasoning: GenerationReasoning = {
    storyBible: null,
    character: null,
    script: null,
    scene: null,
}

const initialBuffers: StreamBuffers = {
    storyBible: { content: '', reasoning: '' },
    character: { content: '', reasoning: '' },
    script: { content: '', reasoning: '' },
    scene: { content: '', reasoning: '' },
}

const initialEntities: Entities = {
    characters: [],
    locations: [],
    props: [],
}

const initialShowLayers: ShowLayersState = {
    entities: false,
    scenes: false,
}

const initialState: ScriptState = {
    projectId: null,
    storyBibleOutline: null,
    scriptOutline: null,
    scenes: null,
    entities: initialEntities,
    isGenerating: initialGenerating,
    errors: initialErrors,
    reasoning: initialReasoning,
    _buffers: initialBuffers,
    showLayers: initialShowLayers,
    openChat: true,
}

// ============================================================================
// STORE
// ============================================================================

export const useScriptStore = create<ScriptState & ScriptActions>((set, get) => ({
    ...initialState,

    // -------------------------------------------------------------------------
    // Initialization
    // -------------------------------------------------------------------------

    initialize: (projectId, data) => set({
        projectId,
        storyBibleOutline: data?.storyBibleOutline ?? null,
        scriptOutline: data?.scriptOutline ?? null,
        scenes: data?.scenes ?? null,
        entities: {
            characters: data?.entities?.characters ?? [],
            locations: data?.entities?.locations ?? [],
            props: data?.entities?.props ?? [],
        },
        isGenerating: initialGenerating,
        errors: initialErrors,
        reasoning: initialReasoning,
        _buffers: initialBuffers,
    }),

    reset: () => set(initialState),

    // -------------------------------------------------------------------------
    // Data Setters
    // -------------------------------------------------------------------------

    setStoryBibleOutline: (outline) => set({ storyBibleOutline: outline }),
    setScriptOutline: (outline) => set({ scriptOutline: outline }),
    setScenes: (scenes) => set({ scenes }),

    setEntities: (entities) => set((state) => ({
        entities: {
            characters: entities.characters ?? state.entities.characters,
            locations: entities.locations ?? state.entities.locations,
            props: entities.props ?? state.entities.props,
        },
    })),

    addCharacter: (character) => set((state) => ({
        entities: {
            ...state.entities,
            characters: [...state.entities.characters, character],
        },
    })),

    addLocation: (location) => set((state) => ({
        entities: {
            ...state.entities,
            locations: [...state.entities.locations, location],
        },
    })),

    addProp: (prop) => set((state) => ({
        entities: {
            ...state.entities,
            props: [...state.entities.props, prop],
        },
    })),

    setShowLayers: (type, show) => set((state) => ({
        showLayers: { ...state.showLayers, [type]: show },
    })),

    toggleLayer: (type) => set((state) => ({
        showLayers: { ...state.showLayers, [type]: !state.showLayers[type] },
    })),
    toggleChat: () => set((state) => ({
        openChat: !state.openChat,
    })),

    // -------------------------------------------------------------------------
    // Generation State
    // -------------------------------------------------------------------------

    setIsGenerating: (type, isGenerating) => set((state) => ({
        isGenerating: { ...state.isGenerating, [type]: isGenerating },
    })),

    setError: (type, error) => set((state) => ({
        errors: { ...state.errors, [type]: error },
    })),

    setReasoning: (type, reasoning) => set((state) => ({
        reasoning: { ...state.reasoning, [type]: reasoning },
    })),

    clearErrors: () => set({ errors: initialErrors }),
    clearReasoning: () => set({ reasoning: initialReasoning }),

    // -------------------------------------------------------------------------
    // Delta Handlers
    // -------------------------------------------------------------------------

    handleStoryBibleDelta: (data) => {
        if (!data?.text) return

        set((state) => {
            const newBuffers = { ...state._buffers }
            
            if (data.type === 'text') {
                newBuffers.storyBible.content += data.text
            } else if (data.type === 'reasoning') {
                newBuffers.storyBible.reasoning += data.text
            }

            let storyBibleOutline = state.storyBibleOutline
            if (data.type === 'text' && newBuffers.storyBible.content) {
                try {
                    const parsed = parsePartialJson(newBuffers.storyBible.content)
                    if (parsed && typeof parsed === 'object') {
                        storyBibleOutline = parsed as Partial<StoryBibleOutline>
                    }
                } catch {
                    // Partial JSON not yet parseable
                }
            }

            const reasoning = data.type === 'reasoning'
                ? { ...state.reasoning, storyBible: newBuffers.storyBible.reasoning }
                : state.reasoning

            return { _buffers: newBuffers, storyBibleOutline, reasoning }
        })
    },

    handleCharacterDelta: (data) => {
        if (!data?.text) return

        set((state) => {
            const newBuffers = { ...state._buffers }
            
            if (data.type === 'text') {
                newBuffers.character.content += data.text
            } else if (data.type === 'reasoning') {
                newBuffers.character.reasoning += data.text
            }

            let entities = state.entities
            if (data.type === 'text' && newBuffers.character.content) {
                try {
                    const parsed = parsePartialJson(newBuffers.character.content)
                    if (Array.isArray(parsed)) {
                        // Filter out incomplete characters - only keep those with at least a name
                        const validCharacters = parsed.filter(
                            (char): char is Character => 
                                char && typeof char === 'object' && typeof char.name === 'string' && char.name.length > 0
                        )
                        entities = { ...state.entities, characters: validCharacters }
                    }
                } catch {
                    // Partial JSON not yet parseable
                }
            }

            const reasoning = data.type === 'reasoning'
                ? { ...state.reasoning, character: newBuffers.character.reasoning }
                : state.reasoning

            return { _buffers: newBuffers, entities, reasoning }
        })
    },

    handleScriptDelta: (data) => {
        if (!data?.text) return

        set((state) => {
            const newBuffers = { ...state._buffers }
            
            if (data.type === 'text') {
                newBuffers.script.content += data.text
            } else if (data.type === 'reasoning') {
                newBuffers.script.reasoning += data.text
            }

            let scriptOutline = state.scriptOutline
            if (data.type === 'text' && newBuffers.script.content) {
                try {
                    const parsed = parsePartialJson(newBuffers.script.content)
                    if (parsed && typeof parsed === 'object') {
                        scriptOutline = parsed as Partial<ScriptOutline>
                    }
                } catch {
                    // Partial JSON not yet parseable
                }
            }

            const reasoning = data.type === 'reasoning'
                ? { ...state.reasoning, script: newBuffers.script.reasoning }
                : state.reasoning

            return { _buffers: newBuffers, scriptOutline, reasoning }
        })
    },

    handleSceneDelta: (data) => {
        if (!data?.text) return

        set((state) => {
            const newBuffers = { ...state._buffers }
            
            if (data.type === 'text') {
                newBuffers.scene.content += data.text
            } else if (data.type === 'reasoning') {
                newBuffers.scene.reasoning += data.text
            }

            let scenes = state.scenes
            if (data.type === 'text' && newBuffers.scene.content) {
                try {
                    const parsed = parsePartialJson(newBuffers.scene.content)
                    if (parsed && typeof parsed === 'object') {
                        scenes = parsed as JSONContent
                    }
                } catch {
                    // Partial JSON not yet parseable
                }
            }

            const reasoning = data.type === 'reasoning'
                ? { ...state.reasoning, scene: newBuffers.scene.reasoning }
                : state.reasoning

            return { _buffers: newBuffers, scenes, reasoning }
        })
    },

    // -------------------------------------------------------------------------
    // Start/End Event Handlers
    // -------------------------------------------------------------------------

    handleEventStart: (eventName) => {
        const componentType = startEventToComponentType[eventName]
        
        set((state) => {
            const newState: Partial<ScriptState> = {
                isGenerating: { ...state.isGenerating, [componentType]: true },
                errors: { ...state.errors, [componentType]: null },
                reasoning: { ...state.reasoning, [componentType]: null },
                _buffers: {
                    ...state._buffers,
                    [componentType]: { content: '', reasoning: '' },
                },
            }

            // Reset the appropriate data based on component type
            switch (componentType) {
                case 'storyBible':
                    newState.storyBibleOutline = null
                    break
                case 'character':
                    newState.entities = { ...state.entities, characters: [] }
                    break
                case 'script':
                    newState.scriptOutline = null
                    break
                case 'scene':
                    newState.scenes = null
                    break
            }

            return newState
        })
    },

    handleEventEnd: (eventName) => {
        const componentType = endEventToComponentType[eventName]
        
        set((state) => ({
            isGenerating: { ...state.isGenerating, [componentType]: false },
        }))
    },

    handleEventDelta: (eventName, data) => {
        const componentType = deltaEventToComponentType[eventName]
        const { handleStoryBibleDelta, handleCharacterDelta, handleScriptDelta, handleSceneDelta } = get()

        switch (componentType) {
            case 'storyBible':
                handleStoryBibleDelta(data)
                break
            case 'character':
                console.log('character delta', data)
                handleCharacterDelta(data)
                break
            case 'script':
                handleScriptDelta(data)
                break
            case 'scene':
                handleSceneDelta(data)
                break
        }
    },

    handleEventError: (eventName, data) => {
        const componentType = errorEventToComponentType[eventName]
        const errorMessage = data?.error ?? defaultErrorMessages[componentType]
        
        set((state) => ({
            isGenerating: { ...state.isGenerating, [componentType]: false },
            errors: { ...state.errors, [componentType]: errorMessage },
        }))
    },

    // -------------------------------------------------------------------------
    // Stream Event Handler
    // -------------------------------------------------------------------------

    handleStreamEvent: (event) => {
        const { event: eventName, data } = event
        const { handleEventStart, handleEventEnd, handleEventDelta, handleEventError } = get()

        switch (eventName) {
            // Start events
            case 'story_bible_start':
            case 'character_start':
            case 'script_start':
            case 'scene_start':
                handleEventStart(eventName)
                break

            // Delta events
            case 'story_bible_delta':
            case 'character_delta':
            case 'script_delta':
            case 'scene_delta':
                handleEventDelta(eventName, data as DeltaData)
                break

            // End events
            case 'story_bible_end':
            case 'character_end':
            case 'script_end':
            case 'scene_end':
                handleEventEnd(eventName)
                break

            // Error events
            case 'story_bible_error':
            case 'character_error':
            case 'script_error':
            case 'scene_error':
                handleEventError(eventName, data as ErrorData)
                break

            // Generic error
            case 'error': {
                if (!data) break
                const errorData = data as ErrorData | string
                const errorMessage = typeof errorData === 'string'
                    ? errorData
                    : errorData?.error ?? 'Stream error'

                const isStreamNotFound = errorMessage.toLowerCase().includes('not found') ||
                    errorMessage.toLowerCase().includes('expired')

                if (!isStreamNotFound) {
                    set({
                        isGenerating: initialGenerating,
                        errors: {
                            storyBible: errorMessage,
                            character: errorMessage,
                            script: errorMessage,
                            scene: errorMessage,
                        },
                    })
                }
                break
            }

            default:
                console.log('Unhandled script event:', eventName, data)
        }
    },
}))
