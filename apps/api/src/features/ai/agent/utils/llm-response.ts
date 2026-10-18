import { CompleteReason, FilePendingOperation, TokenUsage } from "@/type"

export const streamEvents = {
  textDelta: "text_delta",
  reasoningDelta: "reasoning_delta",
  complete: "complete",
  usage: "usage",
  error: "error",
  abort: "abort",
  toolCall: "tool_call",
  toolCallStart: "tool_call_start",
  toolCallDelta: "tool_call_delta",
  toolCallEnd: "tool_call_end",
  toolResultDelta: "tool_result_delta",
  toolResultComplete: "tool_result_complete",
  operation: "operation",
  progressUpdate: "progress_update",
} as const

export type ToolResultDelta = {
  type: typeof streamEvents.toolResultDelta
  toolCallId: string
  toolName: string
  chunk: Record<string, unknown>
}

export type ToolResultComplete = {
  type: typeof streamEvents.toolResultComplete
  toolName: string
  toolCallId: string
  success: boolean
  output: string
  usage: Omit<TokenUsage, "modelId">
  metadata?: Record<string, unknown>
}

// This will be emitted by te execute function of tool that runs sub-agents
export type AgenticToolChunk = {
  type: typeof streamEvents.toolResultComplete
  success: boolean
  output: string
  usage: Omit<TokenUsage, "modelId">
  metadata?: Record<string, unknown>
}

export type OperationChunk = {
  type: typeof streamEvents.operation
  operation: FilePendingOperation
}

export type ToolResultEvent = ToolResultDelta | ToolResultComplete

type TextDelta = {
  type: typeof streamEvents.textDelta
  text: string
}

type ReasoningDelta = {
  type: typeof streamEvents.reasoningDelta
  text: string
}

type Usage = {
  type: typeof streamEvents.usage
  usage: TokenUsage
  latestRunUsage: TokenUsage | null
}

type ToolCallDelta = {
  type: typeof streamEvents.toolCallDelta
  toolCallId: string
  input: string
}

export type ToolCallStart = {
  type: typeof streamEvents.toolCallStart
  toolCallId: string
  toolName: string
  input: string
}

export type ToolCallEnd = {
  type: typeof streamEvents.toolCallEnd
  toolCallId: string
}

export type ToolCall = {
  type: typeof streamEvents.toolCall
  toolCallId: string
  toolName: string
  input: unknown
}

export type ProgressUpdate = {
  type: typeof streamEvents.progressUpdate
  toolCallId: string
  text: string
}

type ErrorChunk = {
  type: typeof streamEvents.error
  error: string
}

export type LlmCompleteChunk = {
  type: typeof streamEvents.complete
  text: string
  finishReason: CompleteReason
  usage: TokenUsage
  error?: string
  reasoningText?: string
  vendor?: string
}

export type LlmChunk =
  | TextDelta
  | ReasoningDelta
  | Usage
  | ToolCallStart
  | ToolCallDelta
  | ToolCallEnd
  | ToolCall
  | ProgressUpdate
  | ErrorChunk
  | LlmCompleteChunk
