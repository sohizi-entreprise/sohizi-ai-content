import { ModelMessage, ToolSet, LanguageModelUsage } from "ai"
import { z } from "zod"
import {
  generateTextWithFailover,
  streamTextWithFailover,
} from "@/features/ai/llm/router"
import { LlmChunk, LlmCompleteChunk, streamEvents } from "./llm-response"
import { TokenUsage, CompleteReason } from "@/type"
import type {
  Billable,
  BillableContext,
  BillableResult,
  BillableStream,
  Credits,
} from "@/features/billing/types"
import type { ResolvedVendorModel } from "@/features/models/repo"
import {
  calculateTextCredits,
  loaded_cost_usd,
  retail_price_usd,
  credits_to_charge,
} from "@/features/billing/credits"
import {
  TOPUP_TARGET_MARGIN,
  PAYMENT_FEE_RESERVE,
  ESTIMATE_OVERBOOKING_FACTOR,
  TOKEN_OVERHEAD_RATE,
  CREDIT_RATE,
} from "@/features/billing/constants"
import { getErrorMessage } from "@/utils/get-error-message"
import { simpleHash } from "@/utils/simple-hash"

export type ReasoningEffort =
  "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max"

export type ModelConfig = {
  tools?: ToolSet
  temperature?: number
  reasoningEffort?: ReasoningEffort
  reasoningSummary?: "auto" | "none"
  maxRetries?: number
  maxOutputTokens?: number
  timeout?: number
}

export type InvokeRequest = {
  messages: ModelMessage[]
  abortSignal: AbortSignal
  outputSchema?: z.ZodSchema
  stream?: boolean
  telemetryFunctionId?: string
}

export class LlmClient {
  private readonly model: string
  private readonly tools: ToolSet | undefined
  private readonly modelConfig: ModelConfig | undefined

  constructor(modelId: string, config: ModelConfig) {
    this.model = modelId
    this.modelConfig = config
    this.tools = config.tools
  }

  async *invoke(request: InvokeRequest) {
    const { stream = true } = request
    if (stream) {
      yield* this.streamResponse(request)
    } else {
      yield* this.fullResponse(request)
    }
  }

  private async *fullResponse({
    messages,
    abortSignal,
    outputSchema,
    telemetryFunctionId,
  }: Omit<InvokeRequest, "stream">): AsyncGenerator<LlmChunk, void, unknown> {
    const modelConfig = this.modelConfig
    let cost = 0

    try {
      const response = await generateTextWithFailover({
        modelId: this.model,
        messages,
        abortSignal,
        tools: this.tools,
        outputSchema,
        maxOutputTokens: modelConfig?.maxOutputTokens,
        reasoningEffort: modelConfig?.reasoningEffort,
        reasoningSummary: modelConfig?.reasoningSummary,
        telemetryFunctionId,
      })
      cost = response.costUsd

      yield {
        type: streamEvents.complete,
        text: response.text,
        finishReason: response.finishReason,
        usage: this.getTokenUsage(response.usage, cost),
      }
    } catch (error) {
      yield {
        type: streamEvents.complete,
        text: "",
        finishReason: "error",
        error: getErrorMessage(error),
        usage: {
          input: 0,
          output: 0,
          reasoning: 0,
          cached: 0,
          total: 0,
          modelId: this.model,
          cost,
        },
      }
    }
  }

  private async *streamResponse({
    messages,
    abortSignal,
    outputSchema,
    telemetryFunctionId,
  }: Omit<InvokeRequest, "stream">): AsyncGenerator<LlmChunk, void, unknown> {
    const modelConfig = this.modelConfig
    let finishReason: CompleteReason = "other"
    let error: string | undefined
    let text = ""
    let reasoningText = ""
    let toolDeltaBuffered = ""
    let usage: TokenUsage = {
      input: 0,
      output: 0,
      reasoning: 0,
      cached: 0,
      total: 0,
      modelId: this.model,
      cost: 0,
    }

    try {
      const response = await streamTextWithFailover({
        modelId: this.model,
        messages,
        abortSignal,
        tools: this.tools,
        outputSchema,
        maxOutputTokens: modelConfig?.maxOutputTokens,
        reasoningEffort: modelConfig?.reasoningEffort,
        reasoningSummary: modelConfig?.reasoningSummary,
        telemetryFunctionId,
      })
      for await (const chunk of response.stream) {
        switch (chunk.type) {
          case "text-delta":
            text += chunk.text
            yield {
              type: streamEvents.textDelta,
              text,
            }
            break
          case "reasoning-delta": {
            reasoningText += chunk.text
            yield {
              type: streamEvents.reasoningDelta,
              text: reasoningText,
            }
            break
          }
          case "abort": {
            if (finishReason !== "error") {
              finishReason = "abort"
            }
            break
          }
          case "error": {
            error = getErrorMessage(chunk.error)
            finishReason = "error"
            yield {
              type: streamEvents.error,
              error,
            }
            break
          }

          case "tool-input-start": {
            yield {
              type: streamEvents.toolCallStart,
              toolCallId: chunk.id,
              toolName: chunk.toolName,
              input: "",
            }
            break
          }

          case "tool-input-delta": {
            toolDeltaBuffered += chunk.delta
            yield {
              type: streamEvents.toolCallDelta,
              toolCallId: chunk.id,
              input: toolDeltaBuffered,
            }
            break
          }

          case "tool-input-end": {
            yield {
              type: streamEvents.toolCallEnd,
              toolCallId: chunk.id,
            }
            break
          }

          case "tool-call": {
            yield {
              type: streamEvents.toolCall,
              toolCallId: chunk.toolCallId,
              toolName: chunk.toolName,
              input: chunk.input as unknown,
            }
            break
          }

          default:
            break
        }
      }
      const [tokenUsage, finish, cost] = await Promise.all([
        response.usage,
        response.finishReason,
        response.costUsd,
      ])
      usage = this.getTokenUsage(tokenUsage, cost)
      finishReason = finish
    } catch (e) {
      error = getErrorMessage(e)
      finishReason = "error"
      yield {
        type: streamEvents.error,
        error,
      }
    } finally {
      yield {
        type: streamEvents.complete,
        text,
        finishReason,
        error,
        usage,
        reasoningText,
      }
    }
  }

  private getTokenUsage(usage: LanguageModelUsage, cost = 0): TokenUsage {
    return {
      input: usage.inputTokens || 0,
      output: usage.outputTokens || 0,
      reasoning: usage.outputTokenDetails.reasoningTokens || 0,
      cached:
        (usage.inputTokenDetails.cacheReadTokens || 0) +
        (usage.inputTokenDetails.cacheWriteTokens || 0),
      total: usage.totalTokens || 0,
      modelId: this.model,
      cost,
    }
  }
}

export type BillableLlmInput = {
  messages: ModelMessage[]
  outputSchema?: z.ZodSchema
  stream?: boolean
  estimatedInputTokens: number
  estimatedOutputTokens: number
  telemetryFunctionId?: string
}

export type BillableLlmOutput = {
  text: string
  finishReason: CompleteReason
  usage: TokenUsage
  reasoningText?: string
  error?: string
}

export type BillableLlmConfig = {
  model: ResolvedVendorModel
  modelConfig: ModelConfig
  timeoutMs?: number
  ttlMs?: number
}

const DEFAULT_TIMEOUT_MS = 600_000 // 10 minutes

/**
 * A BillableLlmClient satisfies both:
 *  - `Billable<...>`        → usable with `withBilling(...)` (buffered one-shot calls)
 *  - `BillableStream<...>`  → usable with `withBillingStream(...)` (live streaming;
 *                             the agent loop forwards chunks to the SSE client)
 *
 * Estimation, idempotency, and per-token cost math live here so callers
 * never re-implement billing logic.
 */
export type BillableLlmClient = Billable<BillableLlmInput, BillableLlmOutput> &
  BillableStream<BillableLlmInput, LlmChunk>

export function createBillableLlmClient(
  config: BillableLlmConfig,
): BillableLlmClient {
  const { model, modelConfig, timeoutMs = DEFAULT_TIMEOUT_MS, ttlMs } = config
  const client = new LlmClient(model.id, modelConfig)

  const creditsFromUsage = (usage: TokenUsage): Credits => {
    if (usage.cost > 0) {
      const loadedCostUsd = loaded_cost_usd(usage.cost, TOKEN_OVERHEAD_RATE)
      const retailPriceUsd = retail_price_usd(
        loadedCostUsd,
        TOPUP_TARGET_MARGIN,
        PAYMENT_FEE_RESERVE,
      )
      return BigInt(credits_to_charge(retailPriceUsd, CREDIT_RATE))
    }

    const actualCredits = calculateTextCredits(
      model,
      {
        inputTokens: usage.input,
        outputTokens: usage.output,
        cachedInputTokens: usage.cached,
      },
      {
        targetMargin: TOPUP_TARGET_MARGIN,
        paymentFeeReserve: PAYMENT_FEE_RESERVE,
      },
    )
    return BigInt(actualCredits)
  }

  async function* stream(
    input: BillableLlmInput,
    abortSignal: AbortSignal,
  ): AsyncGenerator<LlmChunk, void, unknown> {
    yield* client.invoke({
      messages: input.messages,
      abortSignal,
      outputSchema: input.outputSchema,
      stream: input.stream,
      telemetryFunctionId: input.telemetryFunctionId,
    })
  }

  return {
    operation: `llm:${model.id}`,
    timeoutMs,
    ttlMs,

    stream,

    terminalCredits(chunk: LlmChunk): Credits | null {
      if (chunk.type === streamEvents.complete) {
        return creditsFromUsage(chunk.usage)
      }
      return null
    },

    estimateCost(input: BillableLlmInput): Credits {
      const estimatedUsage = {
        inputTokens: input.estimatedInputTokens,
        outputTokens: input.estimatedOutputTokens,
      }
      const credits = calculateTextCredits(model, estimatedUsage, {
        targetMargin: TOPUP_TARGET_MARGIN,
        paymentFeeReserve: PAYMENT_FEE_RESERVE,
      })
      const overbooked = Math.ceil(credits * ESTIMATE_OVERBOOKING_FACTOR)
      return BigInt(overbooked)
    },

    async execute(
      input: BillableLlmInput,
      ctx: BillableContext,
    ): Promise<BillableResult<BillableLlmOutput>> {
      // Drain the stream looking for the terminal complete chunk; usage,
      // text, and finishReason are all carried on that chunk so we don't
      // need to buffer intermediate chunks.
      let finalChunk: LlmCompleteChunk | null = null
      for await (const chunk of stream(input, ctx.signal)) {
        if (chunk.type === streamEvents.complete) {
          finalChunk = chunk
        }
      }

      if (!finalChunk) {
        throw new Error("LLM invocation did not produce a complete chunk")
      }

      return {
        output: {
          text: finalChunk.text,
          finishReason: finalChunk.finishReason,
          usage: finalChunk.usage,
          reasoningText: finalChunk.reasoningText,
          error: finalChunk.error,
        },
        actualCredits: creditsFromUsage(finalChunk.usage),
      }
    },

    idempotencyKey(
      input: BillableLlmInput,
      ctx: {
        organizationId: string
        userId?: string | null
        metadata?: Record<string, unknown>
      },
    ): string {
      const runId = ctx.metadata?.runId ?? crypto.randomUUID()
      const messageHash = simpleHash(JSON.stringify(input.messages))
      return `llm:${ctx.organizationId}:${model.apiName}:${messageHash}:${runId}`
    },
  }
}
