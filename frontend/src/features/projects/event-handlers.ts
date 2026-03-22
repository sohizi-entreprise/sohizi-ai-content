import { SseEventHandler } from "@/hooks/use-get-sse"
import { toast } from "sonner"
import { useScriptStore } from "./store/script-store"

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
    story_bible_start: handleStart,
    story_bible_delta: handleDelta,
    story_bible_end: handleEnd,
    story_bible_error: handleError,
} as const

export const sseCharacterEventHandlers = {
    character_start: handleStart,
    character_delta: handleDelta,
    character_end: handleEnd,
    character_error: handleError,
    batch_progress: handleBatchProgress,
} as const

export const sseScriptEventHandlers = {
    script_start: handleStart,
    script_delta: handleDelta,
    script_end: handleEnd,
    script_error: handleError,
} as const

export const sseSceneEventHandlers = {
    scene_start: handleStart,
    scene_delta: handleDelta,
    scene_end: handleEnd,
    scene_error: handleError,
} as const


function handleStart(data: unknown, _options: FuncOptions) {
    const eventData = data as StartData
    const { handleEventStart } = useScriptStore.getState()
    handleEventStart('story_bible_start')
    console.log('[start]', eventData)
}

function handleDelta(data: unknown, _options: FuncOptions) {
    const eventData = data as DeltaData
    const { handleEventDelta } = useScriptStore.getState()
    handleEventDelta('story_bible_delta', eventData)
}

function handleEnd(data: unknown, options: FuncOptions) {
    const eventData = data as EndData
    console.log('[end]', eventData)
    options.closeEventSource()
    const { handleEventEnd } = useScriptStore.getState()
    handleEventEnd('story_bible_end')
}

function handleError(data: unknown, options: FuncOptions) {
    const eventData = data as ErrorData
    console.log('[error]', eventData)
    toast.error(eventData.error, { position: 'top-center' })
    options.closeEventSource()
    const { handleEventError } = useScriptStore.getState()
    handleEventError('story_bible_error', eventData)
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