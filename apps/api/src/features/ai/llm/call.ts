import {
  Output,
  generateText,
  streamText,
  type LanguageModel,
  type ModelMessage,
  type ProviderMetadata,
} from "ai"
import { z } from "zod"
import type {
  LlmCallInput,
  LlmReasoningEffort,
  LlmStream,
  LlmTextResult,
} from "./types"

type ProviderOptions = NonNullable<
  Parameters<typeof generateText>[0]["providerOptions"]
>

type GatewayReasoning = Exclude<
  NonNullable<Parameters<typeof generateText>[0]["reasoning"]>,
  "provider-default"
>

type ModelCallExtras = {
  providerOptions?: ProviderOptions
  reasoning?: GatewayReasoning
  download?: Parameters<typeof generateText>[0]["experimental_download"]
  costFrom: (metadata: ProviderMetadata | undefined) => number
}

function buildOutput(outputSchema?: z.ZodType) {
  if (!outputSchema) return undefined
  if (outputSchema instanceof z.ZodArray) {
    return Output.array({ element: outputSchema.element })
  }
  return Output.object({ schema: outputSchema })
}

export function omitEmptySystemMessages(
  messages: ModelMessage[],
): ModelMessage[] {
  return messages.filter(
    (message) => message.role !== "system" || message.content.trim().length > 0,
  )
}

function callSettings(input: LlmCallInput, extras: ModelCallExtras) {
  return {
    messages: omitEmptySystemMessages(input.messages),
    allowSystemInMessages: true as const,
    abortSignal: input.abortSignal,
    tools: input.tools,
    maxRetries: 0,
    maxOutputTokens: input.maxOutputTokens,
    output: buildOutput(input.outputSchema),
    experimental_download: extras.download,
    telemetry: {
      isEnabled: true,
      functionId: input.telemetryFunctionId ?? "generate-response",
    },
    reasoning: extras.reasoning,
    providerOptions: extras.providerOptions,
  }
}

export async function generateWithModel(
  model: LanguageModel,
  input: LlmCallInput,
  extras: ModelCallExtras,
): Promise<LlmTextResult> {
  const response = await generateText({
    model,
    ...callSettings(input, extras),
  })
  return {
    text: response.text,
    finishReason: response.finishReason,
    usage: response.usage,
    costUsd: extras.costFrom(response.finalStep.providerMetadata),
    ...(input.outputSchema ? { output: response.output } : {}),
  }
}

export function streamWithModel(
  model: LanguageModel,
  input: LlmCallInput,
  extras: ModelCallExtras,
): LlmStream {
  const response = streamText({
    model,
    ...callSettings(input, extras),
  })
  return {
    stream: response.stream,
    usage: response.usage,
    finishReason: response.finishReason,
    costUsd: response.finalStep.then(
      (step) => extras.costFrom(step.providerMetadata),
      () => 0,
    ),
    ...(input.outputSchema ? { output: response.output } : {}),
  }
}

export function openRouterCost(metadata: ProviderMetadata | undefined): number {
  const usage = metadata?.openrouter?.usage as { cost?: number } | undefined
  return typeof usage?.cost === "number" ? usage.cost : 0
}

export function gatewayCost(metadata: ProviderMetadata | undefined): number {
  const gateway = metadata?.gateway
  if (!gateway || typeof gateway !== "object") return 0
  const record = gateway as Record<string, unknown>
  for (const key of ["cost", "totalCost", "marketCost"]) {
    if (typeof record[key] === "number") return record[key]
  }
  const usage = record.usage
  if (
    usage &&
    typeof usage === "object" &&
    typeof (usage as { cost?: unknown }).cost === "number"
  ) {
    return (usage as { cost: number }).cost
  }
  return 0
}

export function openRouterProviderOptions(
  input: LlmCallInput,
): ProviderOptions {
  return {
    openrouter: {
      reasoning: {
        effort: input.reasoningEffort,
        exclude: false,
      },
    },
  }
}

const gatewayReasoningByEffort: Record<LlmReasoningEffort, GatewayReasoning> = {
  none: "none",
  minimal: "minimal",
  low: "low",
  medium: "medium",
  high: "high",
  xhigh: "xhigh",
  // OpenAI's "max" is outside the portable reasoning union.
  max: "xhigh",
}

export function gatewayCallExtras(input: LlmCallInput): {
  reasoning?: GatewayReasoning
  providerOptions?: ProviderOptions
} {
  const openai: Record<string, string> = {}
  if (input.reasoningEffort === "max") openai.reasoningEffort = "max"
  if (input.reasoningSummary) openai.reasoningSummary = input.reasoningSummary

  const providerOptions: ProviderOptions = {}
  if (Object.keys(openai).length > 0) providerOptions.openai = openai
  if (input.gatewayModels && input.gatewayModels.length > 0) {
    providerOptions.gateway = { models: input.gatewayModels }
  }

  return {
    reasoning: input.reasoningEffort
      ? gatewayReasoningByEffort[input.reasoningEffort]
      : undefined,
    providerOptions:
      Object.keys(providerOptions).length > 0 ? providerOptions : undefined,
  }
}
