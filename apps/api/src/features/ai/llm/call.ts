import {
  Output,
  generateText,
  streamText,
  type LanguageModel,
  type ProviderMetadata,
  type ProviderOptions,
} from "ai"
import { z } from "zod"
import type { LlmCallInput, LlmStream, LlmTextResult } from "./types"

type ModelCallExtras = {
  providerOptions?: ProviderOptions
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

function callSettings(input: LlmCallInput, extras: ModelCallExtras) {
  return {
    messages: input.messages,
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
    costUsd: extras.costFrom(response.providerMetadata),
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
    openai: {
      reasoningEffort: input.reasoningEffort,
      reasoningSummary: input.reasoningSummary,
    },
    openrouter: {
      reasoning: {
        effort: input.reasoningEffort,
        exclude: false,
      },
    },
  }
}

export function gatewayProviderOptions(input: LlmCallInput): ProviderOptions {
  return {
    openai: {
      reasoningEffort: input.reasoningEffort,
      reasoningSummary: input.reasoningSummary,
    },
  }
}
