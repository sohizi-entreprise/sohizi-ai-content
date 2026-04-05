import { SseEventHandler } from "@/hooks/use-get-sse"
import { useConversationStore } from "./store/conversation-store"
import { toast } from "sonner"

export const sseEditorEventHandlers = {
    editor_start: handleStart,
    editor_delta: handleDelta,
    editor_end: handleEnd,
    editor_reasoning: handleReasoning,
    editor_operation: handleOperation,
    content_edit: handleWritingEvent,
    editor_error: handleError,
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
    // const expectedData = data as EditorStartData
    const {setIsStreaming} = useConversationStore.getState()
    setIsStreaming(true)
    // setCurrentRun({
    //     runId: expectedData.runId,
    //     finishReason: 'not-finished',
    //     error: null,
    //     messages: [],
    // })
}

function handleDelta(data: unknown, _options: FuncOptions){
    const expectedData = data as EditorDeltaData
    const {updateTextChunk, updateToolCallChunk, updateToolCallDelta} = useConversationStore.getState()
    if(expectedData.type === 'text_delta'){
        updateTextChunk({runId: expectedData.runId, stepId: expectedData.stepId, text: expectedData.text})
        return
    }
    const baseToolContent = {
        toolName: expectedData.metadata.toolName,
        toolId: expectedData.metadata.toolId,
        runId: expectedData.runId, 
        stepId: expectedData.stepId
    }
    switch (expectedData.type) {
        case 'tool_call_delta':
            updateToolCallDelta({...baseToolContent, type: 'tool_call_delta', args: expectedData.metadata.args as string })
            break;
        case 'tool_call_start':
            updateToolCallDelta({...baseToolContent, type: 'tool_call_start', args: expectedData.metadata.args as string })
            break;
        case 'tool_call_end':
            updateToolCallDelta({...baseToolContent, type: 'tool_call_end', args: expectedData.metadata.args as string })
            break;
        case 'tool_call':
            updateToolCallChunk({...baseToolContent, args: expectedData.metadata.args})
            break;
    
        default:
            break;
    }
}

function handleError(data: unknown, _options: FuncOptions){
    const expectedData = data as EditorErrorData
    const {setIsStreaming, setCurrentRun, currentRun} = useConversationStore.getState()
    if(!currentRun) return
    setCurrentRun({...currentRun, finishReason: 'error', error: expectedData.text})
    setIsStreaming(false)
    toast.error(expectedData.text, {
        position: 'top-center',
    })
}

function handleEnd(_data: unknown, _options: FuncOptions){
    // const expectedData = data as EditorStartData
    const {setIsStreaming, setCurrentRun, appendRun, currentRun} = useConversationStore.getState()
    setIsStreaming(false)
    if(!currentRun) return
    appendRun({...currentRun, finishReason: currentRun.error ? 'error' : 'response'})
    setCurrentRun(null)
}

function handleReasoning(data: unknown, _options: FuncOptions){
    const expectedData = data as EditorReasoningData
    const {updateReasoningChunk} = useConversationStore.getState()
    updateReasoningChunk({runId: expectedData.runId, stepId: expectedData.stepId, text: expectedData.text})
}

function handleWritingEvent(data: unknown, _options: FuncOptions){
    const expectedData = data as WritingData
    const {updateWritingChunk} = useConversationStore.getState()
    if(expectedData.type === 'writing_delta'){
        updateWritingChunk({runId: expectedData.runId, stepId: expectedData.stepId, text: expectedData.text})
    }
}

function handleOperation(_data: unknown, _options: FuncOptions){
    const expectedData = _data as EditorOperationData
    void expectedData
}