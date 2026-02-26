import { create } from 'zustand'
import { parse as parsePartialJson } from 'partial-json'
import { NarrativeArc, Synopsis } from '../type'
import { StreamEvent } from '@/hooks/use-resumable-stream'

// ============================================================================
// TYPES
// ============================================================================

export type GenerationErrors = {
    concept: string | null
    synopsis: string | null
}

export type GenerationReasoning = {
    concept: string | null
    synopsis: string | null
}

// Text buffers for streaming content
type StreamBuffers = {
    concept: {
        content: string
        reasoning: string
    }
    synopsis: {
        content: string
        reasoning: string
    }
}

// Data format from server concept_delta events
type ConceptDeltaData = {
    runId: string
    type: 'content' | 'reasoning'
    text: string
}

// Data format from server synopsis_delta events  
type SynopsisDeltaData = {
    runId: string
    type: 'content' | 'reasoning'
    text: string
}

export type GeneratingState = {
    concept: boolean
    synopsis: boolean
}

export type ConceptState = {
    projectId: string | null
    narrativeArcs: NarrativeArc[]
    synopsis: Synopsis | null
    isGenerating: GeneratingState
    errors: GenerationErrors
    reasoning: GenerationReasoning
    _buffers: StreamBuffers
}

// Partial narrative arc for streaming updates
type PartialNarrativeArc = Partial<NarrativeArc>

type ConceptActions = {
    // Initialization
    initialize: (projectId: string, arcs: NarrativeArc[], synopsis?: Synopsis | null) => void
    reset: () => void

    // Narrative Arcs
    setNarrativeArcs: (arcs: NarrativeArc[]) => void
    updateArc: (index: number, updates: Partial<NarrativeArc>) => void
    selectArc: (index: number) => void
    addArc: (arc: NarrativeArc) => void
    removeArc: (index: number) => void

    // Synopsis
    setSynopsis: (synopsis: Synopsis) => void
    updateSynopsis: (updates: Partial<Synopsis>) => void

    // Generation state
    setIsGenerating: (type: keyof GeneratingState, isGenerating: boolean) => void

    // Errors & Reasoning
    setError: (type: keyof GenerationErrors, error: string | null) => void
    setReasoning: (type: keyof GenerationReasoning, reasoning: string | null) => void
    clearErrors: () => void
    clearReasoning: () => void

    // Stream event handlers
    handleStreamEvent: (event: StreamEvent<PartialNarrativeArc[] | Partial<Synopsis> | unknown>) => void

    // Selectors
    getSelectedArc: () => NarrativeArc | null
    hasSelection: () => boolean
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialErrors: GenerationErrors = {
    concept: null,
    synopsis: null,
}

const initialReasoning: GenerationReasoning = {
    concept: null,
    synopsis: null,
}

const initialBuffers: StreamBuffers = {
    concept: { content: '', reasoning: '' },
    synopsis: { content: '', reasoning: '' },
}

const initialGenerating: GeneratingState = {
    concept: false,
    synopsis: false,
}

const initialState: ConceptState = {
    projectId: null,
    narrativeArcs: [],
    synopsis: null,
    isGenerating: initialGenerating,
    errors: initialErrors,
    reasoning: initialReasoning,
    _buffers: initialBuffers,
}

// ============================================================================
// STORE
// ============================================================================

export const useConceptStore = create<ConceptState & ConceptActions>((set, get) => ({
    ...initialState,

    // -------------------------------------------------------------------------
    // Initialization
    // -------------------------------------------------------------------------

    initialize: (projectId, arcs, synopsis = null) => set({
        projectId,
        narrativeArcs: arcs,
        synopsis,
        isGenerating: initialGenerating,
    }),

    reset: () => set(initialState),

    // -------------------------------------------------------------------------
    // Narrative Arcs
    // -------------------------------------------------------------------------

    setNarrativeArcs: (arcs) => set({ narrativeArcs: arcs }),

    updateArc: (index, updates) => set((state) => {
        const newArcs = [...state.narrativeArcs]
        if (index >= 0 && index < newArcs.length) {
            newArcs[index] = { ...newArcs[index], ...updates }
        }
        return { narrativeArcs: newArcs }
    }),

    selectArc: (index) => set((state) => ({
        narrativeArcs: state.narrativeArcs.map((arc, i) => ({
            ...arc,
            isSelected: i === index,
        })),
    })),

    addArc: (arc) => set((state) => ({
        narrativeArcs: [...state.narrativeArcs, arc],
    })),

    removeArc: (index) => set((state) => ({
        narrativeArcs: state.narrativeArcs.filter((_, i) => i !== index),
    })),

    // -------------------------------------------------------------------------
    // Synopsis
    // -------------------------------------------------------------------------

    setSynopsis: (synopsis) => set({ synopsis }),

    updateSynopsis: (updates) => set((state) => ({
        synopsis: state.synopsis ? { ...state.synopsis, ...updates } : null,
    })),

    // -------------------------------------------------------------------------
    // Generation state
    // -------------------------------------------------------------------------

    setIsGenerating: (type, isGenerating) => set((state) => ({
        isGenerating: { ...state.isGenerating, [type]: isGenerating }
    })),

    // -------------------------------------------------------------------------
    // Errors & Reasoning
    // -------------------------------------------------------------------------

    setError: (type, error) => set((state) => ({
        errors: { ...state.errors, [type]: error }
    })),

    setReasoning: (type, reasoning) => set((state) => ({
        reasoning: { ...state.reasoning, [type]: reasoning }
    })),

    clearErrors: () => set({ errors: initialErrors }),

    clearReasoning: () => set({ reasoning: initialReasoning }),

    // -------------------------------------------------------------------------
    // Stream event handlers
    // -------------------------------------------------------------------------

    handleStreamEvent: (event) => {
        const { event: eventName, data } = event

        switch (eventName) {
            // Concept events
            case 'concept_start':
                set((state) => ({ 
                    isGenerating: { ...state.isGenerating, concept: true }, 
                    narrativeArcs: [],
                    errors: { ...state.errors, concept: null },
                    reasoning: { ...state.reasoning, concept: null },
                    _buffers: {
                        ...state._buffers,
                        concept: { content: '', reasoning: '' },
                    },
                }))
                break

            case 'concept_delta': {
                const deltaData = data as ConceptDeltaData
                if (!deltaData?.text) break

                set((state) => {
                    // Update the appropriate buffer
                    const newBuffers = { ...state._buffers }
                    if (deltaData.type === 'content') {
                        newBuffers.concept.content += deltaData.text
                    } else if (deltaData.type === 'reasoning') {
                        newBuffers.concept.reasoning += deltaData.text
                    }

                    // Try to parse the buffered content as partial JSON
                    let narrativeArcs = state.narrativeArcs
                    if (deltaData.type === 'content' && newBuffers.concept.content) {
                        try {
                            const parsed = parsePartialJson(newBuffers.concept.content)
                            if (Array.isArray(parsed)) {
                                narrativeArcs = parsed as NarrativeArc[]
                            }
                        } catch {
                            // Partial JSON not yet parseable, continue buffering
                        }
                    }

                    // Update reasoning if it's a reasoning chunk
                    const reasoning = deltaData.type === 'reasoning'
                        ? { ...state.reasoning, concept: newBuffers.concept.reasoning }
                        : state.reasoning

                    return { 
                        _buffers: newBuffers, 
                        narrativeArcs,
                        reasoning,
                    }
                })
                break
            }

            case 'concept_end':
                set((state) => ({ isGenerating: { ...state.isGenerating, concept: false } }))
                break

            case 'concept_error': {
                const errorData = data as { error?: string; message?: string }
                const errorMessage = errorData?.error ?? errorData?.message ?? 'Concept generation failed'
                set((state) => ({ 
                    isGenerating: { ...state.isGenerating, concept: false },
                    errors: { ...state.errors, concept: errorMessage },
                }))
                break
            }

            // Synopsis events
            case 'synopsis_start':
                set((state) => ({ 
                    isGenerating: { ...state.isGenerating, synopsis: true }, 
                    synopsis: null,
                    errors: { ...state.errors, synopsis: null },
                    reasoning: { ...state.reasoning, synopsis: null },
                    _buffers: {
                        ...state._buffers,
                        synopsis: { content: '', reasoning: '' },
                    },
                }))
                break

            case 'synopsis_delta': {
                const deltaData = data as SynopsisDeltaData
                if (!deltaData?.text) break

                set((state) => {
                    // Update the appropriate buffer
                    const newBuffers = { ...state._buffers }
                    if (deltaData.type === 'content') {
                        newBuffers.synopsis.content += deltaData.text
                    } else if (deltaData.type === 'reasoning') {
                        newBuffers.synopsis.reasoning += deltaData.text
                    }

                    // Try to parse the buffered content as partial JSON
                    let synopsis = state.synopsis
                    if (deltaData.type === 'content' && newBuffers.synopsis.content) {
                        try {
                            const parsed = parsePartialJson(newBuffers.synopsis.content) as Partial<Synopsis>
                            if (parsed && typeof parsed === 'object') {
                                synopsis = {
                                    title: parsed.title ?? state.synopsis?.title ?? '',
                                    text: parsed.text ?? state.synopsis?.text ?? '',
                                }
                            }
                        } catch {
                            // Partial JSON not yet parseable, continue buffering
                        }
                    }

                    // Update reasoning if it's a reasoning chunk
                    const reasoning = deltaData.type === 'reasoning'
                        ? { ...state.reasoning, synopsis: newBuffers.synopsis.reasoning }
                        : state.reasoning

                    return { 
                        _buffers: newBuffers, 
                        synopsis,
                        reasoning,
                    }
                })
                break
            }

            case 'synopsis_end':
                set((state) => ({ isGenerating: { ...state.isGenerating, synopsis: false } }))
                break

            case 'synopsis_error': {
                const errorData = data as { error?: string; message?: string }
                const errorMessage = errorData?.error ?? errorData?.message ?? 'Synopsis generation failed'
                set((state) => ({ 
                    isGenerating: { ...state.isGenerating, synopsis: false },
                    errors: { ...state.errors, synopsis: errorMessage },
                }))
                break
            }

            case 'error': {
                // Ignore null/undefined error data - this typically happens when 
                // auto-subscribing to a stream that doesn't exist yet
                if (!data) break

                const errorData = data as { type?: string; data?: { message?: string }; error?: string; message?: string } | string
                const errorMessage = typeof errorData === 'string' 
                    ? errorData 
                    : errorData?.data?.message ?? errorData?.error ?? errorData?.message ?? 'Stream error'
                
                // Don't set isGenerating to false for "stream not found" errors
                // This happens when auto-subscribing before a stream exists
                const isStreamNotFound = errorMessage.toLowerCase().includes('not found') || 
                                         errorMessage.toLowerCase().includes('expired')
                
                if (!isStreamNotFound) {
                    set((state) => ({ 
                        isGenerating: { concept: false, synopsis: false },
                        errors: { 
                            concept: state.errors.concept ?? errorMessage,
                            synopsis: state.errors.synopsis ?? errorMessage,
                        },
                    }))
                }
                break
            }

            default:
                console.log('Unhandled event:', eventName, data)
        }
    },

    // -------------------------------------------------------------------------
    // Selectors
    // -------------------------------------------------------------------------

    getSelectedArc: () => {
        const { narrativeArcs } = get()
        return narrativeArcs.find((arc) => arc.isSelected) ?? null
    },

    hasSelection: () => {
        const { narrativeArcs } = get()
        return narrativeArcs.some((arc) => arc.isSelected)
    },
}))
