import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import {
  setDefaultTranscriberForTests,
  type TranscribeInput,
  type TranscribeOutput,
} from "@/features/ai/llm/transcribe"
import type { WithBillingCallContext } from "@/features/billing/wrapper"
import type { ToolExecutionOptions, ToolResult } from "../tool-definition"
import { setMediaOperationDepsForTests } from "./handlers"
import { apiMediaOperationsTool } from "./index"

const captures: Array<{
  youtubeUrl: string
  seconds?: number
  userId: string
}> = []
let accessAllowed = true
let captureResponse = Response.json({
  id: "extraction-1",
  url: "https://media-dev.sohizi.com/youtube_extractions/extraction-1.png",
  requestedSeconds: 42,
  capturedSeconds: 42.1,
})

const options = {
  session: { userId: "user-1", projectId: "project-1" },
} as ToolExecutionOptions

beforeEach(() => {
  captures.length = 0
  accessAllowed = true
  setMediaOperationDepsForTests({
    assertProjectAccess: (async () => {
      if (!accessAllowed) throw new Error("Project access denied")
    }) as never,
    captureYoutubeScreenshot: (async (
      input: { youtubeUrl: string; seconds?: number },
      userId: string,
    ) => {
      captures.push({ ...input, userId })
      return captureResponse
    }) as never,
  })
  captureResponse = Response.json({
    id: "extraction-1",
    url: "https://media-dev.sohizi.com/youtube_extractions/extraction-1.png",
    requestedSeconds: 42,
    capturedSeconds: 42.1,
  })
})

afterEach(() => {
  setMediaOperationDepsForTests(null)
})

describe("YouTube screenshot agent tool", () => {
  test("passes a URL and timestamp through the media API handler", async () => {
    const result = (await apiMediaOperationsTool.params.execute(
      {
        endpoint: "/media/extract-frame/youtube",
        method: "POST",
        body: { youtubeUrl: "https://youtu.be/example?t=5", seconds: 42 },
      },
      options,
    )) as ToolResult

    expect(result.success).toBe(true)
    expect(captures).toEqual([
      {
        youtubeUrl: "https://youtu.be/example?t=5",
        seconds: 42,
        userId: "user-1",
      },
    ])
    expect(JSON.parse(result.output)).toEqual({
      id: "extraction-1",
      url: "https://media-dev.sohizi.com/youtube_extractions/extraction-1.png",
      requestedSeconds: 42,
      capturedSeconds: 42.1,
    })
  })

  test("allows omitting seconds on the media API endpoint", async () => {
    const result = (await apiMediaOperationsTool.params.execute(
      {
        endpoint: "/media/extract-frame/youtube",
        method: "POST",
        body: { youtubeUrl: "https://www.youtube.com/watch?v=example" },
      },
      options,
    )) as ToolResult

    expect(result.success).toBe(true)
    expect(captures[0]?.seconds).toBeUndefined()
  })

  test("returns a retryable capacity failure", async () => {
    captureResponse = Response.json(
      { error: "Screenshot capacity reached; retry later" },
      { status: 429, headers: { "Retry-After": "5" } },
    )

    const result = (await apiMediaOperationsTool.params.execute(
      {
        endpoint: "/media/extract-frame/youtube",
        method: "POST",
        body: { youtubeUrl: "https://youtu.be/example" },
      },
      options,
    )) as ToolResult

    expect(result).toEqual({
      success: false,
      output:
        "Screenshot capacity reached; retry later. Retry after 5 seconds.",
    })
  })

  test("does not capture when project access is denied", async () => {
    accessAllowed = false

    const result = (await apiMediaOperationsTool.params.execute(
      {
        endpoint: "/media/extract-frame/youtube",
        method: "POST",
        body: { youtubeUrl: "https://youtu.be/example" },
      },
      options,
    )) as ToolResult

    expect(result.success).toBe(false)
    expect(captures).toHaveLength(0)
  })

  test("rejects timestamps outside the HTTP endpoint range", async () => {
    const result = (await apiMediaOperationsTool.params.execute(
      {
        endpoint: "/media/extract-frame/youtube",
        method: "POST",
        body: { youtubeUrl: "https://youtu.be/example", seconds: 86401 },
      },
      options,
    )) as ToolResult

    expect(result.success).toBe(false)
  })
})

describe("Media transcription agent tool (/media/transcribe)", () => {
  const prevR2 = process.env.R2_PUBLIC_URL
  const prevWorker = process.env.CLOUDFLARE_WORKER_URL
  const transcribeCalls: Array<{
    input: TranscribeInput
    ctx: WithBillingCallContext
  }> = []

  beforeEach(() => {
    transcribeCalls.length = 0
    process.env.R2_PUBLIC_URL = "https://cdn.sohizi.test"
    process.env.CLOUDFLARE_WORKER_URL = "https://worker.sohizi.test"

    setDefaultTranscriberForTests(async (input, ctx) => {
      transcribeCalls.push({ input, ctx })
      return {
        text: "Welcome to Sohizi",
        language: "en",
        durationInSeconds: 12,
        segments: [
          { text: "Welcome", startSecond: 0, endSecond: 0.5 },
          { text: "to", startSecond: 0.5, endSecond: 0.8 },
          { text: "Sohizi", startSecond: 0.8, endSecond: 1.5 },
        ],
        words: [
          { word: "Welcome", start: 0, end: 0.5 },
          { word: "to", start: 0.5, end: 0.8 },
          { word: "Sohizi", start: 0.8, end: 1.5 },
        ],
        warnings: [],
        responses: [],
        providerMetadata: {},
        costUsd: 0.0012,
      } satisfies TranscribeOutput
    })
  })

  afterEach(() => {
    setDefaultTranscriberForTests(undefined)
    if (prevR2 === undefined) delete process.env.R2_PUBLIC_URL
    else process.env.R2_PUBLIC_URL = prevR2
    if (prevWorker === undefined) delete process.env.CLOUDFLARE_WORKER_URL
    else process.env.CLOUDFLARE_WORKER_URL = prevWorker
  })

  const transcribeOptions = {
    session: {
      id: "session-1",
      userId: "user-1",
      projectId: "project-1",
      organizationId: "org-1",
      conversationId: "conv-1",
      runId: "run-1",
    },
    abortSignal: new AbortController().signal,
    toolCallId: "tool-call-1",
  } as unknown as ToolExecutionOptions

  test("transcribes a video URL by extracting audio via CDN transformation", async () => {
    const result = (await apiMediaOperationsTool.params.execute(
      {
        endpoint: "/media/transcribe",
        method: "POST",
        body: {
          url: "https://cdn.sohizi.test/videos/abc/interview.mp4",
          startSeconds: 5,
          endSeconds: 20,
        },
      },
      transcribeOptions,
    )) as ToolResult

    expect(result.success).toBe(true)
    expect(transcribeCalls).toHaveLength(1)
    expect(transcribeCalls[0]?.input).toEqual({
      audio:
        "https://cdn.sohizi.test/media/mode=audio,time=5s,duration=15s/videos/abc/interview.mp4",
      estimatedDurationSeconds: 15,
    })
    expect(transcribeCalls[0]?.ctx.organizationId).toBe("org-1")
    expect(transcribeCalls[0]?.ctx.userId).toBe("user-1")
    expect(result.output).toBe(
      "[0-0.5]\nWelcome\n[0.5-0.8]\nto\n[0.8-1.5]\nSohizi",
    )
  })

  test("transcribes an audio URL via Worker trim endpoint", async () => {
    const result = (await apiMediaOperationsTool.params.execute(
      {
        endpoint: "/media/transcribe",
        method: "POST",
        body: {
          url: "https://cdn.sohizi.test/audios/xyz/voiceover.mp3",
          type: "audio",
        },
      },
      transcribeOptions,
    )) as ToolResult

    expect(result.success).toBe(true)
    expect(transcribeCalls).toHaveLength(1)
    expect(transcribeCalls[0]?.input).toEqual({
      audio:
        "https://worker.sohizi.test/v1/trim-audio?key=audios%2Fxyz%2Fvoiceover.mp3&offset=0&duration=600",
      estimatedDurationSeconds: 600,
    })
  })

  test("rejects invalid time range when endSeconds <= startSeconds", async () => {
    const result = (await apiMediaOperationsTool.params.execute(
      {
        endpoint: "/media/transcribe",
        method: "POST",
        body: {
          url: "https://cdn.sohizi.test/videos/abc/interview.mp4",
          startSeconds: 30,
          endSeconds: 10,
        },
      },
      transcribeOptions,
    )) as ToolResult

    expect(result).toEqual({
      success: false,
      output: "endSeconds must be greater than startSeconds.",
    })
    expect(transcribeCalls).toHaveLength(0)
  })

  test("fails when media type cannot be inferred and type is omitted", async () => {
    const result = (await apiMediaOperationsTool.params.execute(
      {
        endpoint: "/media/transcribe",
        method: "POST",
        body: {
          url: "https://cdn.sohizi.test/files/unknown-stream",
        },
      },
      transcribeOptions,
    )) as ToolResult

    expect(result.success).toBe(false)
    expect(result.output).toContain("specify type as 'audio' or 'video'")
    expect(transcribeCalls).toHaveLength(0)
  })
})
