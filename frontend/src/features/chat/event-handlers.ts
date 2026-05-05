import { SseEventHandler } from "@/hooks/use-get-sse"
import { toast } from "sonner"

export const sseEditorEventHandlers = {
    editor_start: handleStart,
    editor_operation: handleOperation,
} as const

type FuncOptions = Parameters<SseEventHandler>[1]
// type EditorStartData = {
//     runId: string
// }

type EditorReasoningData = {
    runId: string
    type: 'reasoning_delta'
    text: string
    stepId: string
}

type EditorToolCallData = {
    runId: string
    type: 'tool_call_delta' | 'tool_call_start' | 'tool_call_end' | 'tool_call'
    metadata: {
        toolName: string
        toolId: string
        args: unknown
    }
    stepId: string
}

type EditorTextDeltaData = {
    runId: string
    type: 'text_delta'
    text: string
    stepId: string
}

type EditorDeltaData = EditorTextDeltaData | EditorToolCallData

type EditorErrorData = {
    runId: string
    type: 'error'
    text: string
}

type WritingStartEnd = {
    runId: string
    type: 'writing_start' | 'writing_end'
}

type WritingDelta = {
    runId: string
    type: 'writing_delta'
    text: string
    stepId: string
}

type WritingData = WritingStartEnd | WritingDelta

type EditorOperationData = {
    runId: string
    type: 'editor_operation'
    documentId: string
    operations: unknown[]
    stepId?: string
}

function handleStart(_data: unknown, _options: FuncOptions){
    // setCurrentRun({
    //     runId: expectedData.runId,
    //     finishReason: 'not-finished',
    //     error: null,
    //     messages: [],
    // })
}



function handleOperation(_data: unknown, _options: FuncOptions){
    const expectedData = _data as EditorOperationData
    void expectedData
}