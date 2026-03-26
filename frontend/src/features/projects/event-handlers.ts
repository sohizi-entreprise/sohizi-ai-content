import { SseEventHandler } from "@/hooks/use-get-sse"
import { toast } from "sonner"
import { DeltaEventName, EndEventName, ErrorEventName, StartEventName, useScriptStore } from "./store/script-store"

type FuncOptions = Parameters<SseEventHandler>[1]

export type StartData = {
    runId: string
}

export type DeltaData = {
    runId: string
    type: 'text' | 'reasoning'
    text: string
}

export type EndData = {
    runId: string
}

export type ErrorData = {
    runId: string
    error: string
}

export type BatchProgressData<T = unknown> = {
    runId: string
    processedSoFar: number
    total: number
    currentBatch: T[]
}

export const sseConceptEventHandlers = {
    concept_start: handleStart,
    concept_delta: handleDelta,
    concept_end: handleEnd,
    concept_error: handleError,
} as const

export const sseSynopsisEventHandlers = {
    synopsis_start: handleStart,
    synopsis_delta: handleDelta,
    synopsis_end: handleEnd,
    synopsis_error: handleError,
} as const

export const sseStoryBibleEventHandlers = {
    story_bible_start: handleStart('story_bible_start'),
    story_bible_delta: handleDelta('story_bible_delta'),
    story_bible_end: handleEnd('story_bible_end'),
    story_bible_error: handleError('story_bible_error'),
} as const

export const sseCharacterEventHandlers = {
    character_start: handleStart('character_start'),
    character_delta: handleDelta('character_delta'),
    character_end: handleEnd('character_end'),
    character_error: handleError('character_error'),
    batch_progress: handleBatchProgress,
} as const

export const sseScriptEventHandlers = {
    script_start: handleStart('script_start'),
    script_delta: handleDelta('script_delta'),
    script_end: handleEnd('script_end'),
    script_error: handleError('script_error'),
} as const

export const sseSceneEventHandlers = {
    scene_start: handleStart('scene_start'),
    scene_delta: handleDelta('scene_delta'),
    scene_end: handleEnd('scene_end'),
    scene_error: handleError('scene_error'),
} as const


function handleStart(eventName: StartEventName) {
    return (data: unknown, _options: FuncOptions) => {
        const eventData = data as StartData
        const { handleEventStart } = useScriptStore.getState()
        handleEventStart(eventName)
        console.log('[start]', eventData)
    }
}

function handleDelta(eventName: DeltaEventName) {
    return (data: unknown, _options: FuncOptions) => {
        const eventData = data as DeltaData
        const { handleEventDelta } = useScriptStore.getState()
        handleEventDelta(eventName, eventData)
    }
}

function handleEnd(eventName: EndEventName) {
    return (data: unknown, options: FuncOptions) => {
        const eventData = data as EndData
        console.log('[end]', eventData)
        options.closeEventSource()
        const { handleEventEnd } = useScriptStore.getState()
        handleEventEnd(eventName)
    }
}

function handleError(eventName: ErrorEventName) {
    return (data: unknown, options: FuncOptions) => {
        const eventData = data as ErrorData
        console.log('[error]', eventData)
        toast.error(eventData.error, { position: 'top-center' })
        options.closeEventSource()
        const { handleEventError } = useScriptStore.getState()
        handleEventError(eventName, eventData)
    }
}

function handleBatchProgress(data: unknown, _options: FuncOptions) {
    const eventData = data as BatchProgressData
    console.log('[batch progress]', eventData)
}

// function handleStoryBibleStart(data: unknown, options: FuncOptions) {
//     const eventData = data as StartData
//     const { handleStreamEvent } = useScriptStore.getState()
//     console.log('[story bible start]', eventData)
// }

// function handleStoryBibleDelta(data: unknown, options: FuncOptions) {
//     const eventData = data as DeltaData
//     console.log('[story bible delta]', eventData)
// }

// function handleStoryBibleEnd(data: unknown, options: FuncOptions) {
//     const eventData = data as EndData
//     console.log('[story bible end]', eventData)
//     options.closeEventSource()
// }