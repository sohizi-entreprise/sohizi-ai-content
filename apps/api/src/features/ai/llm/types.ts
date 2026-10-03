import type {
  FinishReason,
  LanguageModelUsage,
  ModelMessage,
  TextStreamPart,
  ToolSet,
} from "ai"
import type { z } from "zod"

export type LlmReasoningEffort =
  "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max"

export type LlmCallInput = {
  apiName: string
  messages: ModelMessage[]
  abortSignal: AbortSignal
  tools?: ToolSet
  outputSchema?: z.ZodType
  maxOutputTokens?: number
  reasoningEffort?: LlmReasoningEffort
  reasoningSummary?: "auto" | "none"
  telemetryFunctionId?: string
}

export type LlmTextResult = {
  text: string
  finishReason: FinishReason
  usage: LanguageModelUsage
  costUsd: number
}

export type LlmStream = {
  stream: AsyncIterable<TextStreamPart<ToolSet>>
  usage: Promise<LanguageModelUsage>
  finishReason: Promise<FinishReason>
  costUsd: Promise<number>
}

export interface LlmAdapter {
  readonly name: string
  generateText(input: LlmCallInput): Promise<LlmTextResult>
  streamText(input: LlmCallInput): LlmStream
}

export type LlmRoute = {
  modelId: string
  vendorName: string
  adapter: string
  apiName: string
  priority: number
  cooldownMs: number
}

export type LlmFailoverRequest = Omit<LlmCallInput, "apiName"> & {
  modelId: string
}
