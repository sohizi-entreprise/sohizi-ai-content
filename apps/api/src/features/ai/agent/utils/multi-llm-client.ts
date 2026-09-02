import { OpenRouter } from '@openrouter/sdk'
import type { TranscriptionWord } from 'openai/resources/audio/transcriptions'
import type {
  Billable,
  BillableContext,
  BillableResult,
  Credits,
} from '@/features/billing/types'
import {
  AUDIO_OVERHEAD_RATE,
  IMAGE_OVERHEAD_RATE,
  VIDEO_OVERHEAD_RATE,
} from '@/features/billing/constants'
import {
  type ImageSizePreset,
  openRouterImagePresetMap,
} from '@/constants/media'
import openAIClient from '@/lib/open-ai-client'
import { getErrorMessage } from '@/utils/get-error-message'
import { simpleHash } from '@/utils/simple-hash'
import {
  lumenDryRun,
  microsToDollars,
  providerCostToActualCredits,
  providerCostToCredits,
} from '@/features/media-engine/generators/cost-utils'
import {
  LUMEN_BASE_URL,
  MAX_VIDEO_POLL_ATTEMPTS,
  VIDEO_POLL_INTERVAL_MS,
} from '@/features/media-engine/constants'

const DEFAULT_TTS_MODEL = 'google/gemini-3.1-flash-tts-preview'
const DEFAULT_STT_MODEL = 'openai/whisper-large-v3'
const DEFAULT_CAPTION_MODEL = 'whisper-1'
const DEFAULT_MUSIC_MODEL = 'google/lyria-3-clip-preview'
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
const FALLBACK_USD_PER_IMAGE = 0.1
const FALLBACK_USD_PER_VIDEO_SECOND = 0.2
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000
const DEFAULT_TTL_MS = 60 * 60 * 1000
const DEFAULT_MUSIC_COST_USD = 0.04

/**
 * Google Gemini TTS customization.
 * Style can also be steered with inline tags in the text (e.g. `[whispers]`, `[excited]`).
 */
export type GoogleSpeechOptions = {
  /** Prebuilt voice name (e.g. Kore, Puck, Aoede). */
  voice: string
  /** Gemini TTS only supports `pcm` (default). Other providers may accept `mp3`. */
  responseFormat?: 'mp3' | 'pcm'
  speed?: number
  /** Style / director notes — forwarded via provider.options.googleAiStudio. */
  instructions?: string
  /** Optional multi-speaker map (up to 2), forwarded via provider.options.googleAiStudio. */
  speakers?: Array<{ name: string; voice: string }>
  /** Escape hatch for extra Google passthrough fields. */
  providerOptions?: Record<string, unknown>
}

export type WordsWithText = {
  words: TranscriptionWord[]
  text: string
}

export type MultiModalResult<T> = {
  result: T
  costUsd: number
}

export type TextToSpeechRequest = {
  text: string
  model?: string
  options: GoogleSpeechOptions
  abortSignal?: AbortSignal
}

export type SpeechToTextRequest = {
  url: string
  model?: string
  language?: string
  abortSignal?: AbortSignal
}

export type TranscribeCaptionRequest = SpeechToTextRequest

export type GenerateMusicRequest = {
  prompt: string
  model?: string
  abortSignal?: AbortSignal
}

export type GenerateImageRequest = {
  prompt: string
  model: string
  /** UI preset (auto/square/…) or raw OpenRouter aspect ratio. */
  aspectRatio?: ImageSizePreset | string
  resolution?: '512' | '1K' | '2K' | '4K'
  n?: number
  referenceUrls?: string[]
  abortSignal?: AbortSignal
}

export type GenerateVideoRequest = {
  prompt: string
  model: string
  duration: number
  aspectRatio?: '16:9' | '9:16' | '1:1'
  resolution?: '720p' | '1080p'
  referenceUrl?: string
  numVariations?: number
  idempotencyKey?: string
  abortSignal?: AbortSignal
}

export type VideoSubmissionResult = {
  id: string
  costEstimate: { cost: number; currency: string }
}

export type VideoPollResult = {
  url: string
  status: 'completed' | 'failed' | 'queued'
  cost: { cost: number; currency: string }
}

type OpenRouterImageResponse = {
  data?: Array<{ url?: string; b64_json?: string }>
  usage?: { cost?: number }
}

export function getTranscriptionCost(durationSeconds: number): number {
  const ratePerSecond = 0.006 / 60
  return durationSeconds * ratePerSecond
}

export function getTextToSpeechCost(text: string): number {
  const ratePer1MCharacters = 0.6
  return (text.length / 1_000_000) * ratePer1MCharacters
}

export function getMusicCost(): number {
  return DEFAULT_MUSIC_COST_USD
}

export function videoActualCredits(providerCostUsd: number): Credits {
  return providerCostToActualCredits(providerCostUsd, {
    overheadRate: VIDEO_OVERHEAD_RATE,
  })
}

export class MultiModalClient {
  private client: OpenRouter | null = null

  async textToSpeech(
    request: TextToSpeechRequest,
  ): Promise<MultiModalResult<ArrayBuffer>> {
    const model = request.model ?? DEFAULT_TTS_MODEL
    const { options, text, abortSignal } = request

    const googleOptions: Record<string, unknown> = {
      ...options.providerOptions,
    }
    if (options.instructions) {
      googleOptions.instructions = options.instructions
    }
    if (options.speakers?.length) {
      googleOptions.speakers = options.speakers
    }

    // Gemini TTS only accepts pcm (24 kHz / 16-bit mono). We wrap it as
    // WAV so callers can store/play a normal audio file.
    const responseFormat = options.responseFormat ?? 'pcm'
    const apiKey = this.requireApiKey()
    const response = await fetch(`${OPENROUTER_BASE_URL}/audio/speech`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: text,
        voice: options.voice,
        response_format: responseFormat,
        ...(options.speed !== undefined ? { speed: options.speed } : {}),
        provider: {
          options: {
            'google-ai-studio': googleOptions,
          },
        },
      }),
      signal: abortSignal,
    })

    if (!response.ok) {
      const errBody = await response.text().catch(() => '')
      throw new Error(
        `OpenRouter TTS failed (${response.status}): ${errBody.slice(0, 300)}`,
      )
    }

    const rawAudio = await response.arrayBuffer()
    const audio =
      responseFormat === 'pcm'
        ? pcmToWav(
            rawAudio,
            parsePcmSampleRate(response.headers.get('Content-Type')),
          )
        : rawAudio
    const generationId =
      response.headers.get('X-Generation-Id') ??
      response.headers.get('x-generation-id') ??
      undefined

    const costUsd = generationId
      ? await this.getGenerationCostUsd(generationId, getTextToSpeechCost(text))
      : getTextToSpeechCost(text)

    return {
      result: audio,
      costUsd,
    }
  }

  async speechToText(
    request: SpeechToTextRequest,
  ): Promise<MultiModalResult<string>> {
    return this.transcribeOpenRouter(request)
  }

  /**
   * Caption transcription with word timestamps via OpenAI Whisper.
   * OpenRouter STT does not expose word-level timings yet.
   */
  async transcribeCaption(
    request: TranscribeCaptionRequest,
  ): Promise<MultiModalResult<WordsWithText>> {
    const model = request.model ?? DEFAULT_CAPTION_MODEL
    const file = await fetchAudioAsFile(request.url)
    if (!file) {
      throw new Error('Failed to fetch audio for caption transcription')
    }

    const transcript = await openAIClient.audio.transcriptions.create({
      model,
      file,
      response_format: 'verbose_json',
      timestamp_granularities: ['word'],
    })

    const words = transcript.words
    if (!words) {
      throw new Error('No words found in caption transcript')
    }

    const seconds = transcript.usage?.seconds ?? 0
    return {
      result: { words, text: transcript.text },
      costUsd: getTranscriptionCost(seconds),
    }
  }

  async generateMusic(
    request: GenerateMusicRequest,
  ): Promise<MultiModalResult<ArrayBuffer>> {
    const model = request.model ?? DEFAULT_MUSIC_MODEL
    const client = this.getClient()

    const stream = await client.chat.send(
      {
        chatRequest: {
          model,
          stream: true,
          messages: [
            {
              role: 'user',
              content: request.prompt,
            },
          ],
          modalities: ['audio'],
        },
      },
      request.abortSignal ? { signal: request.abortSignal } : undefined,
    )

    const audioChunks: string[] = []
    let cost = 0
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta as
        { audio?: { data?: string } } | undefined
      if (delta?.audio?.data) {
        audioChunks.push(delta.audio.data)
      }
      if (chunk.usage?.cost) {
        cost = chunk.usage.cost
      }
    }

    if (audioChunks.length === 0) {
      throw new Error('No audio found in music generation response')
    }

    const buffer = Buffer.from(audioChunks.join(''), 'base64')
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    )

    return {
      result: arrayBuffer,
      costUsd: cost > 0 ? cost : getMusicCost(),
    }
  }

  async generateImage(
    request: GenerateImageRequest,
  ): Promise<MultiModalResult<string[]>> {
    const apiKey = this.requireApiKey()
    const mapped = mapImageSizeParams(request.aspectRatio, request.resolution)
    const body: Record<string, unknown> = {
      model: request.model,
      prompt: request.prompt,
      n: request.n ?? 1,
    }
    if (mapped.aspectRatio) {
      body.aspect_ratio = mapped.aspectRatio
    }
    if (mapped.resolution) {
      body.resolution = mapped.resolution
    }
    if (request.referenceUrls?.length) {
      body.input_references = request.referenceUrls.map((url) => ({
        type: 'image_url',
        image_url: { url },
      }))
    }

    const response = await fetch(`${OPENROUTER_BASE_URL}/images`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: request.abortSignal,
    })

    if (!response.ok) {
      const errBody = await response.text().catch(() => '')
      throw new Error(
        `OpenRouter image generation failed (${response.status}): ${errBody.slice(0, 300)}`,
      )
    }

    const data = (await response.json()) as OpenRouterImageResponse
    const urls = (data.data ?? [])
      .map((item) => {
        if (item.url) return item.url
        if (item.b64_json) return `data:image/png;base64,${item.b64_json}`
        return null
      })
      .filter((url): url is string => Boolean(url))

    if (urls.length === 0) {
      throw new Error('OpenRouter image generation returned no images')
    }

    return {
      result: urls,
      costUsd: data.usage?.cost ?? FALLBACK_USD_PER_IMAGE * urls.length,
    }
  }

  async generateVideo(
    request: GenerateVideoRequest,
  ): Promise<MultiModalResult<{ url: string }>> {
    const submission = await this.submitVideoGeneration(request)

    for (let attempt = 0; attempt < MAX_VIDEO_POLL_ATTEMPTS; attempt++) {
      if (request.abortSignal?.aborted) {
        throw new Error('Video generation aborted')
      }

      if (attempt > 0) {
        await sleep(VIDEO_POLL_INTERVAL_MS, request.abortSignal)
      }

      const poll = await this.pollVideoGeneration(submission.id)
      if (poll.status === 'completed') {
        return {
          result: { url: poll.url },
          costUsd: poll.cost.cost || submission.costEstimate.cost || 0,
        }
      }
      if (poll.status === 'failed') {
        throw new Error('Video generation failed')
      }
    }

    throw new Error('Video generation timed out while polling')
  }

  async submitVideoGeneration(
    request: GenerateVideoRequest,
  ): Promise<VideoSubmissionResult> {
    const {
      model,
      prompt,
      duration,
      referenceUrl,
      numVariations = 1,
      idempotencyKey,
      resolution = '1080p',
      aspectRatio = '16:9',
    } = request

    const apiKey = process.env.LUMEN_API_KEY
    if (!apiKey) {
      throw new Error('LUMEN_API_KEY is not set')
    }

    let submitRes: Response
    try {
      submitRes = await fetch(`${LUMEN_BASE_URL}/videos`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          prompt,
          aspect_ratio: aspectRatio,
          seconds: duration,
          n: numVariations,
          idempotency_key: idempotencyKey,
          resolution,
          input_reference: referenceUrl
            ? { image_url: referenceUrl }
            : undefined,
        }),
        signal: request.abortSignal,
      })
    } catch (error) {
      throw new Error(`Video submission failed: ${getErrorMessage(error)}`)
    }

    if (!submitRes.ok) {
      throw new Error(
        `Video submission failed (${submitRes.status}): ${submitRes.statusText}`,
      )
    }

    const data = await submitRes.json()
    return {
      id: data.id as string,
      costEstimate: {
        cost: data.metadata.cost_estimate,
        currency: data.metadata.cost_currency,
      },
    }
  }

  async pollVideoGeneration(videoId: string): Promise<VideoPollResult> {
    const apiKey = process.env.LUMEN_API_KEY
    if (!apiKey) {
      throw new Error('LUMEN_API_KEY is not set')
    }

    let pollRes: Response
    try {
      pollRes = await fetch(`${LUMEN_BASE_URL}/videos/${videoId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
    } catch (error) {
      throw new Error(`Video poll failed: ${getErrorMessage(error)}`)
    }

    if (!pollRes.ok) {
      throw new Error(
        `Video poll failed (${pollRes.status}): ${pollRes.statusText}`,
      )
    }

    const result = await pollRes.json()
    if (result.status === 'completed') {
      return {
        url: result.output.url,
        status: 'completed',
        cost: {
          cost: result.metadata.cost || 0,
          currency: result.metadata.cost_currency || 'USD',
        },
      }
    }
    if (result.status === 'failed') {
      return {
        url: '',
        status: 'failed',
        cost: {
          cost: result.metadata.cost || result.metadata.cost_estimate || 0,
          currency:
            result.metadata.cost_currency ||
            result.metadata.cost_currency_estimate ||
            'USD',
        },
      }
    }
    return {
      url: '',
      status: 'queued',
      cost: {
        cost: result.metadata.cost_estimate || 0,
        currency: result.metadata.cost_currency_estimate || 'USD',
      },
    }
  }

  private async transcribeOpenRouter(
    request: SpeechToTextRequest,
  ): Promise<MultiModalResult<string>> {
    const model = request.model ?? DEFAULT_STT_MODEL
    const inputAudio = await fetchAudioAsBase64(request.url)
    const client = this.getClient()

    const response = await client.stt.createTranscription(
      {
        sttRequest: {
          model,
          inputAudio,
          language: request.language,
        },
      },
      request.abortSignal ? { signal: request.abortSignal } : undefined,
    )

    const seconds = response.usage?.seconds ?? 0
    const costUsd =
      response.usage?.cost ?? (seconds > 0 ? getTranscriptionCost(seconds) : 0)

    return {
      result: response.text,
      costUsd,
    }
  }

  /**
   * OpenRouter returns `X-Generation-Id` on TTS before `/generation` can
   * resolve it (eventual consistency). Retry briefly on 404, then fall back.
   */
  private async getGenerationCostUsd(
    generationId: string,
    fallbackUsd: number,
  ): Promise<number> {
    const delaysMs = [0, 1000, 1500]

    for (let attempt = 0; attempt < delaysMs.length; attempt++) {
      const delayMs = delaysMs[attempt]
      if (delayMs > 0) {
        await sleep(delayMs)
      }

      try {
        const generation = await this.getClient().generations.getGeneration({
          id: generationId,
        })
        console.log('generation', generation, '\n----------\n')
        const reported = generation.data.usage ?? generation.data.totalCost
        if (typeof reported === 'number' && reported > 0) {
          return reported
        }
        // Metadata present but cost not set yet — keep retrying.
      } catch (error) {
        const statusCode =
          error && typeof error === 'object' && 'statusCode' in error
            ? Number((error as { statusCode: unknown }).statusCode)
            : undefined

        if (statusCode === 404 && attempt < delaysMs.length - 1) {
          continue
        }

        console.warn(
          `[MultiModalClient] failed to fetch generation cost for ${generationId}`,
          error,
        )
        break
      }
    }

    return fallbackUsd
  }

  private getClient(): OpenRouter {
    if (this.client) {
      return this.client
    }
    this.client = new OpenRouter({
      apiKey: this.requireApiKey(),
    })
    return this.client
  }

  private requireApiKey(): string {
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY is not set')
    }
    return apiKey
  }
}

// ---------------------------------------------------------------------------
// Billable wrapper
// ---------------------------------------------------------------------------

export type BillableMultiModalInput =
  | {
      kind: 'tts'
      text: string
      model?: string
      options: GoogleSpeechOptions
      estimatedChars?: number
    }
  | {
      kind: 'stt'
      url: string
      model?: string
      language?: string
      estimatedDurationSeconds: number
    }
  | {
      kind: 'caption'
      url: string
      model?: string
      language?: string
      estimatedDurationSeconds: number
    }
  | {
      kind: 'music'
      prompt: string
      model?: string
      estimatedCostUsd?: number
    }
  | {
      kind: 'image'
      prompt: string
      model: string
      aspectRatio?: ImageSizePreset | string
      resolution?: '512' | '1K' | '2K' | '4K'
      n?: number
      referenceUrls?: string[]
    }
  | {
      kind: 'video'
      prompt: string
      model: string
      duration: number
      aspectRatio?: '16:9' | '9:16' | '1:1'
      resolution?: '720p' | '1080p'
      referenceUrl?: string
      numVariations?: number
      idempotencyKey?: string
    }

export type BillableMultiModalOutput =
  | { kind: 'tts'; audio: ArrayBuffer; costUsd: number }
  | { kind: 'stt'; text: string; costUsd: number }
  | {
      kind: 'caption'
      text: string
      words: TranscriptionWord[]
      costUsd: number
    }
  | { kind: 'music'; audio: ArrayBuffer; costUsd: number }
  | { kind: 'image'; urls: string[]; costUsd: number }
  | { kind: 'video'; url: string; costUsd: number }

export type BillableMultiModalConfig = {
  timeoutMs?: number
  ttlMs?: number
}

export type BillableMultiModalClient = Billable<
  BillableMultiModalInput,
  BillableMultiModalOutput
>

export function createBillableMultiModalClient(
  config: BillableMultiModalConfig = {},
): BillableMultiModalClient {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ttlMs = DEFAULT_TTL_MS } = config
  const client = new MultiModalClient()

  return {
    operation: 'media:multimodal',
    timeoutMs,
    ttlMs,

    async estimateCost(input: BillableMultiModalInput): Promise<Credits> {
      switch (input.kind) {
        case 'tts': {
          const chars = input.estimatedChars ?? input.text.length
          const costUsd = (chars / 1_000_000) * 0.6
          return providerCostToCredits(costUsd, {
            overheadRate: AUDIO_OVERHEAD_RATE,
          })
        }
        case 'stt':
        case 'caption': {
          const costUsd = getTranscriptionCost(input.estimatedDurationSeconds)
          return providerCostToCredits(costUsd, {
            overheadRate: AUDIO_OVERHEAD_RATE,
          })
        }
        case 'music': {
          const costUsd = input.estimatedCostUsd ?? getMusicCost()
          return providerCostToCredits(costUsd, {
            overheadRate: AUDIO_OVERHEAD_RATE,
          })
        }
        case 'image': {
          const n = input.n ?? 1
          const costUsd = FALLBACK_USD_PER_IMAGE * n
          return providerCostToCredits(costUsd, {
            overheadRate: IMAGE_OVERHEAD_RATE,
          })
        }
        case 'video': {
          const costUsd = await estimateVideoCostUsd(input)
          return providerCostToCredits(costUsd, {
            overheadRate: VIDEO_OVERHEAD_RATE,
          })
        }
      }
    },

    async execute(
      input: BillableMultiModalInput,
      ctx: BillableContext,
    ): Promise<BillableResult<BillableMultiModalOutput>> {
      switch (input.kind) {
        case 'tts': {
          const { result, costUsd } = await client.textToSpeech({
            text: input.text,
            model: input.model,
            options: input.options,
            abortSignal: ctx.signal,
          })
          return {
            output: { kind: 'tts', audio: result, costUsd },
            actualCredits: creditsFromCostUsd(costUsd, AUDIO_OVERHEAD_RATE),
          }
        }
        case 'stt': {
          const { result, costUsd } = await client.speechToText({
            url: input.url,
            model: input.model,
            language: input.language,
            abortSignal: ctx.signal,
          })
          return {
            output: { kind: 'stt', text: result, costUsd },
            actualCredits: creditsFromCostUsd(costUsd, AUDIO_OVERHEAD_RATE),
          }
        }
        case 'caption': {
          const { result, costUsd } = await client.transcribeCaption({
            url: input.url,
            model: input.model,
            language: input.language,
            abortSignal: ctx.signal,
          })
          return {
            output: {
              kind: 'caption',
              text: result.text,
              words: result.words,
              costUsd,
            },
            actualCredits: creditsFromCostUsd(costUsd, AUDIO_OVERHEAD_RATE),
          }
        }
        case 'music': {
          const { result, costUsd } = await client.generateMusic({
            prompt: input.prompt,
            model: input.model,
            abortSignal: ctx.signal,
          })
          return {
            output: { kind: 'music', audio: result, costUsd },
            actualCredits: creditsFromCostUsd(costUsd, AUDIO_OVERHEAD_RATE),
          }
        }
        case 'image': {
          const { result, costUsd } = await client.generateImage({
            prompt: input.prompt,
            model: input.model,
            aspectRatio: input.aspectRatio,
            resolution: input.resolution,
            n: input.n,
            referenceUrls: input.referenceUrls,
            abortSignal: ctx.signal,
          })
          return {
            output: { kind: 'image', urls: result, costUsd },
            actualCredits: creditsFromCostUsd(costUsd, IMAGE_OVERHEAD_RATE),
          }
        }
        case 'video': {
          const { result, costUsd } = await client.generateVideo({
            prompt: input.prompt,
            model: input.model,
            duration: input.duration,
            aspectRatio: input.aspectRatio,
            resolution: input.resolution,
            referenceUrl: input.referenceUrl,
            numVariations: input.numVariations,
            idempotencyKey: input.idempotencyKey,
            abortSignal: ctx.signal,
          })
          return {
            output: { kind: 'video', url: result.url, costUsd },
            actualCredits: creditsFromCostUsd(costUsd, VIDEO_OVERHEAD_RATE),
          }
        }
      }
    },

    idempotencyKey(
      input: BillableMultiModalInput,
      ctx: {
        organizationId: string
        userId?: string | null
        metadata?: Record<string, unknown>
      },
    ): string {
      const runId = ctx.metadata?.runId ?? crypto.randomUUID()
      const payloadHash = simpleHash(stableInputKey(input))
      return `media:${input.kind}:${ctx.organizationId}:${payloadHash}:${runId}`
    },
  }
}

function mapImageSizeParams(
  aspectRatio?: string,
  resolution?: '512' | '1K' | '2K' | '4K',
): { aspectRatio?: string; resolution?: '512' | '1K' | '2K' | '4K' } {
  if (aspectRatio && aspectRatio in openRouterImagePresetMap) {
    const mapped = openRouterImagePresetMap[aspectRatio as ImageSizePreset]
    return {
      aspectRatio: mapped.aspectRatio,
      resolution: resolution ?? mapped.resolution,
    }
  }
  return { aspectRatio, resolution }
}

function creditsFromCostUsd(costUsd: number, overheadRate: number): Credits {
  const safeCost = costUsd > 0 ? costUsd : 0.001
  return providerCostToActualCredits(safeCost, { overheadRate })
}

async function estimateVideoCostUsd(
  input: Extract<BillableMultiModalInput, { kind: 'video' }>,
): Promise<number> {
  const numVariations = input.numVariations ?? 1
  const aspectRatio = input.aspectRatio ?? '16:9'
  const resolution = input.resolution ?? '1080p'

  const dryRunBody: Record<string, unknown> = {
    model: input.model,
    prompt: input.prompt,
    aspect_ratio: aspectRatio,
    seconds: input.duration,
    n: numVariations,
    resolution,
  }
  if (input.referenceUrl) {
    dryRunBody.input_reference = { image_url: input.referenceUrl }
  }

  const dryRun = await lumenDryRun('/videos', dryRunBody)
  if (dryRun) {
    return microsToDollars(dryRun.total_cost_micros)
  }
  return FALLBACK_USD_PER_VIDEO_SECOND * input.duration * numVariations
}

function stableInputKey(input: BillableMultiModalInput): string {
  switch (input.kind) {
    case 'tts':
      return JSON.stringify({
        kind: input.kind,
        text: input.text,
        model: input.model,
        voice: input.options.voice,
        speakers: input.options.speakers,
        instructions: input.options.instructions,
      })
    case 'stt':
    case 'caption':
      return JSON.stringify({
        kind: input.kind,
        url: input.url,
        model: input.model,
        language: input.language,
      })
    case 'music':
      return JSON.stringify({
        kind: input.kind,
        prompt: input.prompt,
        model: input.model,
      })
    case 'image':
      return JSON.stringify({
        kind: input.kind,
        prompt: input.prompt,
        model: input.model,
        aspectRatio: input.aspectRatio,
        resolution: input.resolution,
        n: input.n,
        referenceUrls: input.referenceUrls,
      })
    case 'video':
      return (
        input.idempotencyKey ??
        JSON.stringify({
          kind: input.kind,
          prompt: input.prompt,
          model: input.model,
          duration: input.duration,
          aspectRatio: input.aspectRatio,
          resolution: input.resolution,
          referenceUrl: input.referenceUrl,
        })
      )
  }
}

async function fetchAudioAsBase64(
  url: string,
): Promise<{ data: string; format: string }> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(
      `Failed to fetch audio for transcription (${response.status})`,
    )
  }
  const arrayBuffer = await response.arrayBuffer()
  const contentType = response.headers.get('content-type') ?? 'audio/mpeg'
  return {
    data: Buffer.from(arrayBuffer).toString('base64'),
    format: mimeToAudioFormat(contentType),
  }
}

async function fetchAudioAsFile(url: string): Promise<File | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      return null
    }
    const blob = await response.blob()
    const type = blob.type || 'audio/mpeg'
    return new File([blob], 'audio.mp3', { type })
  } catch {
    return null
  }
}

/** Gemini TTS returns PCM; Content-Type may include rate=24000;channels=1. */
function parsePcmSampleRate(contentType: string | null): number {
  const match = contentType?.match(/rate=(\d+)/i)
  if (match) {
    const rate = Number(match[1])
    if (Number.isFinite(rate) && rate > 0) return rate
  }
  return 24_000
}

function pcmToWav(
  pcm: ArrayBuffer,
  sampleRate = 24_000,
  channels = 1,
  bitsPerSample = 16,
): ArrayBuffer {
  const pcmBytes = Buffer.from(pcm)
  const blockAlign = channels * (bitsPerSample / 8)
  const byteRate = sampleRate * blockAlign
  const header = Buffer.alloc(44)

  header.write('RIFF', 0)
  header.writeUInt32LE(36 + pcmBytes.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)
  header.write('data', 36)
  header.writeUInt32LE(pcmBytes.length, 40)

  return Buffer.concat([header, pcmBytes]).buffer
}

function mimeToAudioFormat(contentType: string): string {
  const mime = contentType.split(';')[0]?.trim().toLowerCase() ?? ''
  const map: Record<string, string> = {
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/wave': 'wav',
    'audio/flac': 'flac',
    'audio/mp4': 'm4a',
    'audio/m4a': 'm4a',
    'audio/ogg': 'ogg',
    'audio/webm': 'webm',
    'audio/aac': 'aac',
  }
  return map[mime] ?? 'mp3'
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Aborted'))
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new Error('Aborted'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
