import { CompleteReason, TokenUsage } from "@/type";

export const streamEvents = {
    textDelta: 'text_delta',
    reasoningDelta: 'reasoning_delta',
    complete: 'complete',
    usage: 'usage',
    error: 'error',
    abort: 'abort',
    toolCall: 'tool_call',
    toolCallStart: 'tool_call_start',
    toolCallDelta: 'tool_call_delta',
    toolCallEnd: 'tool_call_end',
    toolResultDelta: 'tool_result_delta',
    toolResultComplete: 'tool_result_complete',
} as const;


export type ToolResultDelta = {
    type: typeof streamEvents.toolResultDelta;
    toolCallId: string;
    toolName: string;
    chunk: Record<string, unknown>;
}

export type ToolResultComplete = {
    type: typeof streamEvents.toolResultComplete;
    toolName: string;
    toolCallId: string;
    success: boolean;
    output: string;
    usage: Omit<TokenUsage, 'modelId'>;
    metadata?: Record<string, unknown>;
}

// This will be emitted by te execute function of tool that runs sub-agents
export type AgenticToolChunk = {
    type: typeof streamEvents.toolResultComplete;
    success: boolean;
    output: string;
    usage: Omit<TokenUsage, 'modelId'>;
    metadata?: Record<string, unknown>;
}

export type ToolResultEvent = ToolResultDelta | ToolResultComplete;


type TextDelta = {
    type: typeof streamEvents.textDelta;
    text: string;
}

type ReasoningDelta = {
    type: typeof streamEvents.reasoningDelta;
    text: string;
}

type Usage = {
    type: typeof streamEvents.usage;
    usage: TokenUsage;
}

type ToolCallDelta = {
    type: typeof streamEvents.toolCallDelta;
    toolCallId: string;
    input: string;
}

type ToolCallStart = {
    type: typeof streamEvents.toolCallStart;
    toolCallId: string;
    toolName: string;
    input: string;
}

type ToolCallEnd = {
    type: typeof streamEvents.toolCallEnd;
    toolCallId: string;
}

export type ToolCall = {
    type: typeof streamEvents.toolCall;
    toolCallId: string;
    toolName: string;
    input: string;
}

type ErrorChunk = {
    type: typeof streamEvents.error;
    error: string;
}

type Complete = {
    type: typeof streamEvents.complete;
    text: string;
    finishReason: CompleteReason;
    usage: TokenUsage;
    error?: string
    reasoningText?: string;
}

export type LlmChunk = TextDelta | ReasoningDelta | Usage | ToolCallStart | ToolCallDelta | ToolCallEnd | ToolCall | ErrorChunk | Complete;