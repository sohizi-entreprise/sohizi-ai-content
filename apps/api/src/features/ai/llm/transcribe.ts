import {
  createGateway,
  transcribe,
  type DataContent,
  type TranscriptionModel,
  type TranscriptionResult,
} from "ai"
import { AUDIO_OVERHEAD_RATE } from "@/features/billing/constants"
import { billingService, type BillingService } from "@/features/billing/service"
import type {
  Billable,
  BillableContext,
  BillableResult,
  Credits,
} from "@/features/billing/types"
import {
  withBilling,
  type WithBillingCallContext,
} from "@/features/billing/wrapper"
import {
  providerCostToActualCredits,
  providerCostToCredits,
} from "@/features/media-engine/generators/cost-utils"
import { BadRequest, InternalServerError } from "@/features/error"
import { simpleHash } from "@/utils/simple-hash"
import { gatewayCost } from "./call"

/** OpenAI Whisper model routed through the Vercel AI Gateway. */
export const WHISPER_MODEL_ID = "openai/whisper-1" as const

/** OpenAI Whisper API pricing: $0.006 per minute of audio ($0.0001 per second). */
export const WHISPER_COST_PER_MINUTE_USD = 0.006
export const WHISPER_COST_PER_SECOND_USD = WHISPER_COST_PER_MINUTE_USD / 60

const DEFAULT_TRANSCRIPTION_TIMEOUT_MS = 5 * 60 * 1000
const DEFAULT_TRANSCRIPTION_TTL_MS = 30 * 60 * 1000

export type TranscribeWord = {
  word: string
  start: number
  end: number
}

export type TranscribeInput = {
  /** Audio data or URL to transcribe. */
  audio: string | URL | DataContent
  /** Estimated audio duration in seconds used for credit reservation. */
  estimatedDurationSeconds: number
  /** Optional language hint (ISO-639-1 code). */
  language?: string
  /** Optional prompt to guide transcription. */
  prompt?: string
}

export type TranscribeOutput = {
  text: string
  segments: TranscriptionResult["segments"]
  words: TranscribeWord[]
  language: TranscriptionResult["language"]
  durationInSeconds: TranscriptionResult["durationInSeconds"]
  warnings: TranscriptionResult["warnings"]
  responses: TranscriptionResult["responses"]
  providerMetadata: TranscriptionResult["providerMetadata"]
  costUsd: number
}

export type TranscribeClientDeps = {
  apiKey?: string
  resolveModel?: (apiKey: string) => TranscriptionModel
  runTranscribe?: typeof transcribe
}

const gatewayProviders = new Map<string, ReturnType<typeof createGateway>>()

function getGatewayProvider(apiKey: string) {
  const cached = gatewayProviders.get(apiKey)
  if (cached) return cached
  const provider = createGateway({ apiKey })
  gatewayProviders.set(apiKey, provider)
  return provider
}

function resolveGatewayApiKey(explicitKey?: string): string {
  const key = explicitKey?.trim() || process.env.VERCEL_GATEWAY_API_KEY?.trim()
  if (!key) {
    throw new Error(
      "VERCEL_GATEWAY_API_KEY is required for audio transcription",
    )
  }
  return key
}

/**
 * Calculate the OpenAI Whisper provider cost in USD for a given audio duration.
 * Whisper bills $0.006 / minute ($0.0001 / second), rounded to the nearest second.
 */
export function calculateWhisperCostUsd(durationSeconds: number): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return 0
  }
  const billableSeconds = Math.ceil(durationSeconds)
  return billableSeconds * WHISPER_COST_PER_SECOND_USD
}

export function estimateWhisperCredits(durationSeconds: number): Credits {
  const costUsd = calculateWhisperCostUsd(Math.max(durationSeconds, 1))
  return providerCostToCredits(costUsd, {
    overheadRate: AUDIO_OVERHEAD_RATE,
  })
}

export function actualWhisperCredits(providerCostUsd: number): Credits {
  const safeCost =
    Number.isFinite(providerCostUsd) && providerCostUsd > 0
      ? providerCostUsd
      : WHISPER_COST_PER_SECOND_USD
  return providerCostToActualCredits(safeCost, {
    overheadRate: AUDIO_OVERHEAD_RATE,
  })
}

function normalizeAudioInput(
  audio: TranscribeInput["audio"],
): DataContent | URL {
  if (typeof audio === "string") {
    if (audio.startsWith("http://") || audio.startsWith("https://")) {
      return new URL(audio)
    }
    return audio
  }
  return audio
}

function extractWords(result: TranscriptionResult): TranscribeWord[] {
  const rawWords = (
    result as TranscriptionResult & {
      words?: Array<{
        word?: string
        text?: string
        start?: number
        end?: number
        startSecond?: number
        endSecond?: number
      }>
    }
  ).words

  if (Array.isArray(rawWords) && rawWords.length > 0) {
    return rawWords.map((w) => ({
      word: w.word ?? w.text ?? "",
      start: w.start ?? w.startSecond ?? 0,
      end: w.end ?? w.endSecond ?? 0,
    }))
  }

  return (result.segments ?? []).map((segment) => ({
    word: segment.text,
    start: segment.startSecond,
    end: segment.endSecond,
  }))
}

export function createWhisperTranscriptionBillable(
  deps: TranscribeClientDeps = {},
): Billable<TranscribeInput, TranscribeOutput> {
  const runTranscribe = deps.runTranscribe ?? transcribe
  const resolveModel =
    deps.resolveModel ??
    ((apiKey: string) =>
      getGatewayProvider(apiKey).transcription(WHISPER_MODEL_ID))

  return {
    operation: `transcription:${WHISPER_MODEL_ID}`,
    timeoutMs: DEFAULT_TRANSCRIPTION_TIMEOUT_MS,
    ttlMs: DEFAULT_TRANSCRIPTION_TTL_MS,

    estimateCost(input: TranscribeInput): Credits {
      return estimateWhisperCredits(input.estimatedDurationSeconds)
    },

    async execute(
      input: TranscribeInput,
      ctx: BillableContext,
    ): Promise<BillableResult<TranscribeOutput>> {
      const apiKey = resolveGatewayApiKey(deps.apiKey)
      const model = resolveModel(apiKey)

      const openaiOptions: Record<string, JSONValue> = {
        timestampGranularities: ["word"],
      }
      if (input.language) openaiOptions.language = input.language
      if (input.prompt) openaiOptions.prompt = input.prompt

      const result = await runTranscribe({
        model,
        audio: normalizeAudioInput(input.audio),
        providerOptions: {
          openai: openaiOptions,
        },
        abortSignal: ctx.signal,
      })

      const words = extractWords(result)
      const gatewayReportedCost = gatewayCost(result.providerMetadata)
      const durationForPricing =
        typeof result.durationInSeconds === "number" &&
        result.durationInSeconds > 0
          ? result.durationInSeconds
          : input.estimatedDurationSeconds
      const calculatedCost = calculateWhisperCostUsd(durationForPricing)
      const costUsd =
        gatewayReportedCost > 0 ? gatewayReportedCost : calculatedCost

      const output: TranscribeOutput = {
        text: result.text,
        segments: result.segments,
        words,
        language: result.language,
        durationInSeconds: result.durationInSeconds,
        warnings: result.warnings,
        responses: result.responses,
        providerMetadata: result.providerMetadata,
        costUsd,
      }

      return {
        output,
        actualCredits: actualWhisperCredits(costUsd),
        providerCostUsd: costUsd > 0 ? costUsd : undefined,
        metadata: {
          modelId: WHISPER_MODEL_ID,
          vendor: "vercel-gateway",
          ...(result.durationInSeconds !== undefined
            ? { durationInSeconds: result.durationInSeconds }
            : {}),
        },
      }
    },

    idempotencyKey(
      input: TranscribeInput,
      ctx: {
        organizationId: string
        userId?: string | null
        metadata?: Record<string, unknown>
      },
    ): string {
      const runId = ctx.metadata?.runId ?? crypto.randomUUID()
      const audioKey =
        typeof input.audio === "string"
          ? input.audio
          : input.audio instanceof URL
            ? input.audio.toString()
            : `bytes:${input.audio.byteLength}`
      const payloadHash = simpleHash(
        JSON.stringify({
          audio: audioKey,
          language: input.language,
          prompt: input.prompt,
        }),
      )
      return `transcription:${ctx.organizationId}:${WHISPER_MODEL_ID}:${payloadHash}:${runId}`
    },
  }
}

type JSONValue =
  string | number | boolean | null | { [key: string]: JSONValue } | JSONValue[]

export function createBillableWhisperTranscriber(
  billing: BillingService = billingService,
  deps: TranscribeClientDeps = {},
) {
  return withBilling(createWhisperTranscriptionBillable(deps), billing)
}

const defaultTranscriber = createBillableWhisperTranscriber()
let activeTranscriber: typeof defaultTranscriber = defaultTranscriber

export function setDefaultTranscriberForTests(
  transcriber?: typeof defaultTranscriber,
) {
  activeTranscriber = transcriber ?? defaultTranscriber
}

export async function transcribeAudioWithBilling(
  input: TranscribeInput,
  ctx: WithBillingCallContext,
): Promise<TranscribeOutput> {
  return activeTranscriber(input, ctx)
}

export const MAX_TRANSCRIPTION_AUDIO_SECONDS = 600

export function getOAudioUrl(
  url: string,
  type: "audio" | "video",
  offsetSeconds = 0,
  maxDurationSeconds = MAX_TRANSCRIPTION_AUDIO_SECONDS,
): string {
  const cdnUrl = process.env.R2_PUBLIC_URL ?? import.meta.env?.R2_PUBLIC_URL
  const workerUrl =
    process.env.CLOUDFLARE_WORKER_URL ?? import.meta.env?.CLOUDFLARE_WORKER_URL
  if (!cdnUrl || !workerUrl) {
    console.error("R2_PUBLIC_URL or CLOUDFLARE_WORKER_URL is not set")
    throw new InternalServerError(
      "An error occurred while generating the audio url. You can report this issue.",
    )
  }

  const key = extractUrlKey(url)
  if (!key) {
    throw new BadRequest("Invalid media url")
  }

  const offset = Math.max(0, offsetSeconds)
  const duration = Math.max(
    0.1,
    Math.min(maxDurationSeconds, MAX_TRANSCRIPTION_AUDIO_SECONDS),
  )

  let finalUrl = ""
  if (type === "audio") {
    const params = new URLSearchParams({
      key,
      offset: String(offset),
      duration: String(duration),
    })
    finalUrl = `${workerUrl.replace(/\/$/, "")}/v1/trim-audio?${params.toString()}`
  } else {
    const transformation = `mode=audio,time=${offset}s,duration=${duration}s`
    finalUrl = `${cdnUrl.replace(/\/$/, "")}/media/${transformation}/${key}`
  }

  try {
    return new URL(finalUrl).href
  } catch {
    throw new BadRequest("Something went wrong during url parsing")
  }
}

function extractUrlKey(url: string): string | null {
  try {
    const urlObj = new URL(url)
    return urlObj.pathname.replace(/^[/]/, "")
  } catch {
    return null
  }
}
