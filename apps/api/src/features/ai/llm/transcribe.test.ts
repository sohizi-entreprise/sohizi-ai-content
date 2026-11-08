import { describe, expect, it, mock } from "bun:test"
import type { TranscriptionModel, TranscriptionResult } from "ai"
import type { BillingService } from "@/features/billing/service"
import type {
  BillingReservation,
  ReserveInput,
  SettleInput,
} from "@/features/billing/types"
import {
  actualWhisperCredits,
  calculateWhisperCostUsd,
  createBillableWhisperTranscriber,
  estimateWhisperCredits,
  getOAudioUrl,
  WHISPER_COST_PER_MINUTE_USD,
  WHISPER_MODEL_ID,
} from "./transcribe"

function createMockBillingService() {
  const reserves: ReserveInput[] = []
  const settlements: SettleInput[] = []
  const refunds: Array<{ reservationId: string; reason?: string }> = []

  const billing = {
    async reserve(input: ReserveInput): Promise<BillingReservation> {
      reserves.push(input)
      return {
        id: "res-1",
        organizationId: input.organizationId,
        userId: input.userId ?? null,
        operation: input.operation,
        estimatedCredits: input.estimatedCredits,
        balanceReserved: input.estimatedCredits,
        paygReserved: 0n,
        chargedCredits: null,
        status: "reserved",
        idempotencyKey: input.idempotencyKey,
        metadata: input.metadata ?? null,
        expiresAt: new Date(Date.now() + input.ttlMs),
        settledAt: null,
        createdAt: new Date(),
      }
    },
    async settle(input: SettleInput): Promise<BillingReservation> {
      settlements.push(input)
      return {
        id: input.reservationId,
        organizationId: "org-1",
        userId: "user-1",
        operation: `transcription:${WHISPER_MODEL_ID}`,
        estimatedCredits: 10n,
        balanceReserved: 10n,
        paygReserved: 0n,
        chargedCredits: input.actualCredits,
        status: "settled",
        idempotencyKey: "key-1",
        metadata: input.metadata ?? null,
        expiresAt: new Date(),
        settledAt: new Date(),
        createdAt: new Date(),
      }
    },
    async refund(
      reservationId: string,
      reason?: string,
    ): Promise<BillingReservation> {
      refunds.push({ reservationId, reason })
      return {
        id: reservationId,
        organizationId: "org-1",
        userId: "user-1",
        operation: `transcription:${WHISPER_MODEL_ID}`,
        estimatedCredits: 10n,
        balanceReserved: 10n,
        paygReserved: 0n,
        chargedCredits: 0n,
        status: "refunded",
        idempotencyKey: "key-1",
        metadata: reason ? { refundReason: reason } : null,
        expiresAt: new Date(),
        settledAt: new Date(),
        createdAt: new Date(),
      }
    },
  } as unknown as BillingService

  return { billing, reserves, settlements, refunds }
}

describe("Whisper pricing model", () => {
  it("charges $0.006 per minute ($0.0001 per second) rounded up to the second", () => {
    expect(WHISPER_COST_PER_MINUTE_USD).toBe(0.006)
    expect(calculateWhisperCostUsd(60)).toBeCloseTo(0.006, 8)
    expect(calculateWhisperCostUsd(30)).toBeCloseTo(0.003, 8)
    expect(calculateWhisperCostUsd(10.2)).toBeCloseTo(11 * (0.006 / 60), 8)
    expect(calculateWhisperCostUsd(0)).toBe(0)
    expect(calculateWhisperCostUsd(-5)).toBe(0)
  })

  it("converts Whisper USD cost to estimated and actual credits", () => {
    // 60 seconds = $0.006 raw -> * 1.25 audio overhead = $0.0075 -> / $0.003 = 2.5 -> ceil = 3 credits
    // With 1.15 overbooking: ceil(3 * 1.15) = 4 credits
    expect(estimateWhisperCredits(60)).toBe(4n)
    expect(actualWhisperCredits(0.006)).toBe(3n)

    // Short clips: baseCredits = 1 -> ceil(1 * 1.15) = 2 credits reserved, 1 credit actual
    expect(estimateWhisperCredits(3)).toBe(2n)
    expect(actualWhisperCredits(0.0003)).toBe(1n)
  })
})

describe("createBillableWhisperTranscriber", () => {
  it("reserves credits, calls Vercel AI Gateway with openai/whisper-1 and word granularity, settles, and returns all fields", async () => {
    const { billing, reserves, settlements, refunds } =
      createMockBillingService()

    const mockModel = {
      specificationVersion: "v4",
      provider: "gateway",
      modelId: WHISPER_MODEL_ID,
    } as unknown as TranscriptionModel

    const resolveModel = mock((_apiKey: string) => mockModel)
    const fakeResult: TranscriptionResult = {
      text: "Hello world",
      segments: [
        { text: "Hello", startSecond: 0, endSecond: 0.45 },
        { text: "world", startSecond: 0.5, endSecond: 0.95 },
      ],
      language: "en",
      durationInSeconds: 60,
      warnings: [],
      responses: [
        {
          timestamp: new Date("2026-11-08T00:00:00Z"),
          modelId: WHISPER_MODEL_ID,
          headers: { "x-request-id": "req-123" },
          body: { text: "Hello world" },
        },
      ],
      providerMetadata: {
        gateway: {
          cost: 0.006,
        },
      },
    }

    let capturedOptions: Record<string, unknown> | undefined
    const runTranscribe = mock(async (opts: Record<string, unknown>) => {
      capturedOptions = opts
      return fakeResult
    }) as unknown as typeof import("ai").transcribe

    const transcriber = createBillableWhisperTranscriber(billing, {
      apiKey: "test-gateway-key",
      resolveModel,
      runTranscribe,
    })

    const output = await transcriber(
      {
        audio: "https://cdn.example.com/audio.mp3",
        estimatedDurationSeconds: 60,
        language: "en",
      },
      {
        organizationId: "org-1",
        userId: "user-1",
        metadata: { runId: "run-1" },
      },
    )

    expect(resolveModel).toHaveBeenCalledWith("test-gateway-key")
    expect(capturedOptions?.model).toBe(mockModel)
    expect(capturedOptions?.audio).toEqual(
      new URL("https://cdn.example.com/audio.mp3"),
    )
    expect(capturedOptions?.providerOptions).toEqual({
      openai: {
        timestampGranularities: ["word"],
        language: "en",
      },
    })

    expect(reserves).toHaveLength(1)
    expect(reserves[0]?.operation).toBe(`transcription:${WHISPER_MODEL_ID}`)
    expect(reserves[0]?.estimatedCredits).toBe(4n)

    expect(settlements).toHaveLength(1)
    expect(settlements[0]?.reservationId).toBe("res-1")
    expect(settlements[0]?.actualCredits).toBe(3n)
    expect(settlements[0]?.providerCostUsd).toBe(0.006)
    expect(settlements[0]?.metadata).toEqual({
      runId: "run-1",
      modelId: WHISPER_MODEL_ID,
      vendor: "vercel-gateway",
      durationInSeconds: 60,
    })
    expect(refunds).toHaveLength(0)

    expect(output).toEqual({
      text: "Hello world",
      segments: [
        { text: "Hello", startSecond: 0, endSecond: 0.45 },
        { text: "world", startSecond: 0.5, endSecond: 0.95 },
      ],
      words: [
        { word: "Hello", start: 0, end: 0.45 },
        { word: "world", start: 0.5, end: 0.95 },
      ],
      language: "en",
      durationInSeconds: 60,
      warnings: [],
      responses: fakeResult.responses,
      providerMetadata: fakeResult.providerMetadata,
      costUsd: 0.006,
    })
  })

  it("falls back to duration-based Whisper pricing when gateway metadata has no cost", async () => {
    const { billing, settlements } = createMockBillingService()

    const mockModel = {
      specificationVersion: "v4",
      provider: "gateway",
      modelId: WHISPER_MODEL_ID,
    } as unknown as TranscriptionModel

    const fakeResult: TranscriptionResult = {
      text: "Testing fallback pricing",
      segments: [
        { text: "Testing", startSecond: 0, endSecond: 0.4 },
        { text: "fallback", startSecond: 0.4, endSecond: 0.8 },
        { text: "pricing", startSecond: 0.8, endSecond: 1.2 },
      ],
      language: "en",
      durationInSeconds: 120,
      warnings: [],
      responses: [],
      providerMetadata: {},
    }

    const transcriber = createBillableWhisperTranscriber(billing, {
      apiKey: "test-gateway-key",
      resolveModel: () => mockModel,
      runTranscribe: (async () =>
        fakeResult) as unknown as typeof import("ai").transcribe,
    })

    const output = await transcriber(
      {
        audio: new Uint8Array([1, 2, 3]),
        estimatedDurationSeconds: 90,
      },
      {
        organizationId: "org-1",
        userId: "user-1",
      },
    )

    // 120s = 2 minutes = $0.012
    expect(output.costUsd).toBeCloseTo(0.012, 8)
    expect(settlements).toHaveLength(1)
    expect(settlements[0]?.providerCostUsd).toBeCloseTo(0.012, 8)
    // $0.012 * 1.25 = $0.015 / $0.003 = 5 credits
    expect(settlements[0]?.actualCredits).toBe(5n)
  })

  it("refunds reservation when transcription fails", async () => {
    const { billing, reserves, settlements, refunds } =
      createMockBillingService()

    const mockModel = {
      specificationVersion: "v4",
      provider: "gateway",
      modelId: WHISPER_MODEL_ID,
    } as unknown as TranscriptionModel

    const transcriber = createBillableWhisperTranscriber(billing, {
      apiKey: "test-gateway-key",
      resolveModel: () => mockModel,
      runTranscribe: (async () => {
        throw new Error("Gateway transcription error")
      }) as unknown as typeof import("ai").transcribe,
    })

    await expect(
      transcriber(
        {
          audio: "https://cdn.example.com/audio.mp3",
          estimatedDurationSeconds: 30,
        },
        {
          organizationId: "org-1",
          userId: "user-1",
        },
      ),
    ).rejects.toThrow("Gateway transcription error")

    expect(reserves).toHaveLength(1)
    expect(settlements).toHaveLength(0)
    expect(refunds).toEqual([
      { reservationId: "res-1", reason: "execute-error" },
    ])
  })
})

describe("getOAudioUrl", () => {
  it("builds Cloudflare Worker trim URL for audio and CDN media transform URL for video", () => {
    const prevR2 = process.env.R2_PUBLIC_URL
    const prevWorker = process.env.CLOUDFLARE_WORKER_URL
    process.env.R2_PUBLIC_URL = "https://cdn.sohizi.test"
    process.env.CLOUDFLARE_WORKER_URL = "https://worker.sohizi.test"

    try {
      const audioUrl = getOAudioUrl(
        "https://cdn.sohizi.test/audios/123/voice.mp3",
        "audio",
        5,
        25,
      )
      expect(audioUrl).toBe(
        "https://worker.sohizi.test/v1/trim-audio?key=audios%2F123%2Fvoice.mp3&offset=5&duration=25",
      )

      const videoUrl = getOAudioUrl(
        "https://cdn.sohizi.test/videos/456/clip.mp4",
        "video",
        10,
        30,
      )
      expect(videoUrl).toBe(
        "https://cdn.sohizi.test/media/mode=audio,time=10s,duration=30s/videos/456/clip.mp4",
      )
    } finally {
      if (prevR2 === undefined) delete process.env.R2_PUBLIC_URL
      else process.env.R2_PUBLIC_URL = prevR2
      if (prevWorker === undefined) delete process.env.CLOUDFLARE_WORKER_URL
      else process.env.CLOUDFLARE_WORKER_URL = prevWorker
    }
  })
})
