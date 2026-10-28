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
import type { ResolvedTextModel } from "@/features/models/repo"
import {
  calculateTextCredits,
  loaded_cost_usd,
  credits_to_charge,
} from "@/features/billing/credits"
import {
  ESTIMATE_OVERBOOKING_FACTOR,
  TOKEN_OVERHEAD_RATE,
} from "@/features/billing/constants"
import type { BillingService } from "@/features/billing/service"
import {
  withBilling,
  type WithBillingCallContext,
} from "@/features/billing/wrapper"
import { getErrorMessage } from "@/utils/get-error-message"
import { isUserAbort } from "@/features/ai/llm/errors"
import { simpleHash } from "@/utils/simple-hash"

export function isAbortedByUser(
  abortSignal: AbortSignal,
  error?: unknown,
): boolean {
  if (isUserAbort(error)) return true
  if (!abortSignal.aborted) return false
  return isUserAbort(abortSignal.reason) || abortSignal.reason === undefined
}

export type ReasoningEffort =
  "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max"

export type ModelConfig = {
  tools?: ToolSet
  temperature?: number
  reasoningEffort?: ReasoningEffort
  reasoningSummary?: "auto" | "none"
  gatewayModels?: string[]
  maxRetries?: number
  maxOutputTokens?: number
  timeout?: number
}

export type InvokeRequest = {
  messages: ModelMessage[]
  abortSignal: AbortSignal
  outputSchema?: z.ZodType
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
        gatewayModels: modelConfig?.gatewayModels,
        telemetryFunctionId,
      })
      cost = response.costUsd

      yield {
        type: streamEvents.complete,
        text: response.text,
        finishReason: response.finishReason,
        usage: this.getTokenUsage(response.usage, cost),
        vendor: response.vendorName,
        ...(outputSchema ? { output: response.output } : {}),
      }
    } catch (error) {
      if (isAbortedByUser(abortSignal, error)) {
        yield {
          type: streamEvents.complete,
          text: "",
          finishReason: "abort",
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
        return
      }
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

    let vendor: string | undefined
    let structuredOutput: unknown
    let hasStructuredOutput = false
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
        gatewayModels: modelConfig?.gatewayModels,
        telemetryFunctionId,
      })
      vendor = response.vendorName
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
            if (
              finishReason === "abort" ||
              isAbortedByUser(abortSignal, chunk.error)
            ) {
              finishReason = "abort"
              break
            }
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
      if (finishReason === "abort" || isAbortedByUser(abortSignal)) {
        finishReason = "abort"
        error = undefined
        void response.usage.then(undefined, () => undefined)
        void response.finishReason.then(undefined, () => undefined)
        void response.costUsd.then(undefined, () => undefined)
        void response.output?.then(undefined, () => undefined)
      } else {
        const [tokenUsage, finish, cost] = await Promise.all([
          response.usage,
          response.finishReason,
          response.costUsd,
        ])
        usage = this.getTokenUsage(tokenUsage, cost)
        finishReason = finish
        if (outputSchema && response.output) {
          structuredOutput = await response.output
          hasStructuredOutput = true
        }
      }
    } catch (e) {
      if (finishReason === "abort" || isAbortedByUser(abortSignal, e)) {
        finishReason = "abort"
        error = undefined
      } else {
        error = getErrorMessage(e)
        finishReason = "error"
        yield {
          type: streamEvents.error,
          error,
        }
      }
    } finally {
      yield {
        type: streamEvents.complete,
        text,
        finishReason,
        error,
        usage,
        reasoningText,
        vendor,
        ...(hasStructuredOutput ? { output: structuredOutput } : {}),
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

export type BillableLlmInput<
  TSchema extends z.ZodType | undefined = undefined,
> = {
  messages: ModelMessage[]
  outputSchema?: TSchema
  stream?: boolean
  estimatedInputTokens: number
  estimatedOutputTokens: number
  telemetryFunctionId?: string
}

export type BillableLlmOutput<TOutput = undefined> =
  | {
      text: string
      finishReason: CompleteReason
      usage: TokenUsage
      reasoningText?: string
      output: TOutput
      error?: undefined
    }
  | {
      text: string
      finishReason: CompleteReason
      usage: TokenUsage
      reasoningText?: string
      output?: undefined
      error: string
    }

type WideLlmInput = BillableLlmInput<z.ZodType | undefined>

function toBillableLlmOutput(
  chunk: LlmCompleteChunk,
): BillableLlmOutput<unknown> {
  const shared = {
    text: chunk.text,
    finishReason: chunk.finishReason,
    usage: chunk.usage,
    reasoningText: chunk.reasoningText,
  }
  if (chunk.error) {
    return { ...shared, error: chunk.error }
  }
  return { ...shared, output: chunk.output }
}

export type BillableLlmConfig = {
  model: ResolvedTextModel
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
export type BillableLlmClient = Billable<
  WideLlmInput,
  BillableLlmOutput<unknown>
> &
  BillableStream<WideLlmInput, LlmChunk>

export function createBillableLlmClient(
  config: BillableLlmConfig,
): BillableLlmClient {
  const { model, modelConfig, timeoutMs = DEFAULT_TIMEOUT_MS, ttlMs } = config
  const client = new LlmClient(model.id, modelConfig)

  const creditsFromUsage = (usage: TokenUsage): Credits => {
    if (usage.cost > 0) {
      const loadedCostUsd = loaded_cost_usd(usage.cost, TOKEN_OVERHEAD_RATE)
      return BigInt(credits_to_charge(loadedCostUsd))
    }

    const actualCredits = calculateTextCredits(model, {
      inputTokens: usage.input,
      outputTokens: usage.output,
      cachedInputTokens: usage.cached,
    })
    return BigInt(actualCredits)
  }

  async function* stream(
    input: WideLlmInput,
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

    estimateCost(input: WideLlmInput): Credits {
      const estimatedUsage = {
        inputTokens: input.estimatedInputTokens,
        outputTokens: input.estimatedOutputTokens,
      }
      const credits = calculateTextCredits(model, estimatedUsage)
      const overbooked = Math.ceil(credits * ESTIMATE_OVERBOOKING_FACTOR)
      return BigInt(overbooked)
    },

    async execute(
      input: WideLlmInput,
      ctx: BillableContext,
    ): Promise<BillableResult<BillableLlmOutput<unknown>>> {
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
        output: toBillableLlmOutput(finalChunk),
        actualCredits: creditsFromUsage(finalChunk.usage),
      }
    },

    idempotencyKey(
      input: WideLlmInput,
      ctx: {
        organizationId: string
        userId?: string | null
        metadata?: Record<string, unknown>
      },
    ): string {
      const runId = ctx.metadata?.runId ?? crypto.randomUUID()
      const messageHash = simpleHash(JSON.stringify(input.messages))
      return `llm:${ctx.organizationId}:${model.id}:${messageHash}:${runId}`
    },
  }
}

type TypedLlmOutputCall = {
  <TSchema extends z.ZodType>(
    input: BillableLlmInput<TSchema> & { outputSchema: TSchema },
    ctx: WithBillingCallContext,
  ): Promise<BillableLlmOutput<z.output<TSchema>>>
  (
    input: BillableLlmInput,
    ctx: WithBillingCallContext,
  ): Promise<BillableLlmOutput<undefined>>
}

/** Bills through `withBilling` and types `output` from the call's `outputSchema`. */
export function withTypedLlmOutput(
  client: BillableLlmClient,
  billing: BillingService,
): TypedLlmOutputCall {
  const call = withBilling(client, billing)
  return ((input: WideLlmInput, ctx: WithBillingCallContext) =>
    call(input, ctx)) as TypedLlmOutputCall
}
