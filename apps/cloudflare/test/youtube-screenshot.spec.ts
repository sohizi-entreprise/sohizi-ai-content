import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@cloudflare/puppeteer", () => ({
  default: { launch: vi.fn(), connect: vi.fn() },
}))

import puppeteer from "@cloudflare/puppeteer"
import worker from "../src/index"
import { YoutubeBrowserPool } from "../src/youtube/browser-pool"
import { parseYoutubeCaptureInput } from "../src/youtube/parse"
import type { WorkerEnv } from "../src/env"
import { createTestEnv } from "./fakes"

const VIDEO_ID = "M7lc1UVf-VE"
const CAPTURE_URL = "https://worker.test/v1/youtube-screenshots"

type CaptureState = {
  ready: boolean
  error: string | null
  time: number | null
}

function captureRequest(
  body: unknown,
  authorization = "Bearer test-token",
): Request {
  return new Request(CAPTURE_URL, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
}

function mockBrowser(
  state: CaptureState = { ready: true, error: null, time: 90.05 },
) {
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
  const screenshot = vi.fn().mockResolvedValue(png)
  const page = {
    setViewport: vi.fn(),
    goto: vi.fn(),
    waitForFunction: vi.fn(),
    evaluate: vi.fn().mockResolvedValue(state),
    $: vi.fn().mockResolvedValue({ screenshot }),
  }
  const context = {
    newPage: vi.fn().mockResolvedValue(page),
    close: vi.fn(),
  }
  const browser = {
    createBrowserContext: vi.fn().mockResolvedValue(context),
    browserContexts: vi.fn().mockReturnValue([]),
    defaultBrowserContext: vi.fn(),
    isConnected: vi.fn().mockReturnValue(true),
    sessionId: vi.fn().mockReturnValue("session-1"),
  }
  vi.mocked(puppeteer.launch).mockResolvedValue(browser as never)
  vi.mocked(puppeteer.connect).mockResolvedValue(browser as never)
  return { browser, context, page, screenshot, png }
}

function setup(maxTabs = "10") {
  const { bucket, env: baseEnv } = createTestEnv({
    YOUTUBE_SCREENSHOT_TOKEN: "test-token",
    R2_PUBLIC_URL: "https://media-dev.sohizi.com",
    YOUTUBE_SCREENSHOT_MAX_TABS: maxTabs,
  })
  const env = baseEnv as WorkerEnv
  const values = new Map<string, string>()
  const storage = {
    get: vi.fn(async (key: string) => values.get(key)),
    put: vi.fn(async (key: string, value: string) => {
      values.set(key, value)
    }),
    delete: vi.fn(async (key: string) => {
      values.delete(key)
    }),
  }
  const pool = new YoutubeBrowserPool({ storage } as never, env)
  env.YOUTUBE_BROWSER_POOL = {
    getByName: vi.fn(() => ({
      fetch: (request: Request) => pool.fetch(request),
    })),
  } as never
  return { bucket, env, pool, storage }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe("YouTube screenshot route", () => {
  it("parses shared URL times and gives explicit seconds precedence", () => {
    expect(
      parseYoutubeCaptureInput({ youtubeUrl: `https://youtu.be/${VIDEO_ID}` }),
    ).toEqual({ videoId: VIDEO_ID, seconds: 0 })
    expect(
      parseYoutubeCaptureInput({
        youtubeUrl: `https://youtu.be/${VIDEO_ID}?t=1m30s`,
      }),
    ).toEqual({ videoId: VIDEO_ID, seconds: 90 })
    expect(
      parseYoutubeCaptureInput({
        youtubeUrl: `https://www.youtube.com/watch?v=${VIDEO_ID}&t=90`,
        seconds: 12,
      }),
    ).toEqual({ videoId: VIDEO_ID, seconds: 12 })
    expect(() =>
      parseYoutubeCaptureInput({
        youtubeUrl: "https://example.com/watch?v=M7lc1UVf-VE",
        seconds: 1,
      }),
    ).toThrow("Invalid YouTube URL")
  })

  it("requires the server token before reserving a tab", async () => {
    const { env } = setup()
    const response = await worker.fetch(
      captureRequest(
        { youtubeUrl: `https://youtu.be/${VIDEO_ID}` },
        "Bearer wrong",
      ),
      env,
    )
    expect(response.status).toBe(401)
    expect(env.YOUTUBE_BROWSER_POOL.getByName).not.toHaveBeenCalled()
  })

  it("captures the iframe, stores the PNG, and keeps the browser open", async () => {
    const { bucket, env } = setup()
    const put = vi.spyOn(bucket, "put")
    const { browser, context, page, screenshot, png } = mockBrowser()
    const response = await worker.fetch(
      captureRequest({ youtubeUrl: `https://youtu.be/${VIDEO_ID}?t=90` }),
      env,
    )
    const body = (await response.json()) as {
      id: string
      url: string
      requestedSeconds: number
      capturedSeconds: number
    }
    expect(response.status).toBe(200)
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(body.url).toBe(
      `https://media-dev.sohizi.com/youtube_extractions/${body.id}.png`,
    )
    expect(body.requestedSeconds).toBe(90)
    expect(body.capturedSeconds).toBe(90.05)
    expect(page.goto).toHaveBeenCalledWith(
      expect.stringContaining(
        `/v1/youtube-screenshots/player?id=${VIDEO_ID}&seconds=90`,
      ),
      { waitUntil: "domcontentloaded", timeout: 10000 },
    )
    expect(screenshot).toHaveBeenCalledWith({ type: "png" })
    expect(put).toHaveBeenCalledWith(
      `youtube_extractions/${body.id}.png`,
      png,
      { httpMetadata: { contentType: "image/png" } },
    )
    expect(context.close).toHaveBeenCalledOnce()
    expect(browser.createBrowserContext).toHaveBeenCalledOnce()
  })

  it("reuses one browser for repeated requests and produces different IDs", async () => {
    const { bucket, env } = setup()
    mockBrowser()
    const input = { youtubeUrl: `https://youtu.be/${VIDEO_ID}?t=90` }
    const first = (await (
      await worker.fetch(captureRequest(input), env)
    ).json()) as { id: string }
    const second = (await (
      await worker.fetch(captureRequest(input), env)
    ).json()) as { id: string }
    expect(second.id).not.toBe(first.id)
    expect(bucket.objects.size).toBe(2)
    expect(puppeteer.launch).toHaveBeenCalledOnce()
  })

  it("reconnects to its recorded session after Durable Object restart", async () => {
    const { env, storage } = setup()
    mockBrowser()
    await worker.fetch(
      captureRequest({ youtubeUrl: `https://youtu.be/${VIDEO_ID}` }),
      env,
    )
    const restarted = new YoutubeBrowserPool({ storage } as never, env)
    env.YOUTUBE_BROWSER_POOL = {
      getByName: () => ({
        fetch: (request: Request) => restarted.fetch(request),
      }),
    } as never
    const response = await worker.fetch(
      captureRequest({ youtubeUrl: `https://youtu.be/${VIDEO_ID}` }),
      env,
    )
    expect(response.status).toBe(200)
    expect(puppeteer.launch).toHaveBeenCalledOnce()
    expect(puppeteer.connect).toHaveBeenCalledWith(env.BROWSER, "session-1")
  })

  it("caps active tabs at the configured limit", async () => {
    const { env } = setup("10")
    const { page, context } = mockBrowser()
    const resume: Array<() => void> = []
    page.waitForFunction.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resume.push(resolve)
        }),
    )
    const input = { youtubeUrl: `https://youtu.be/${VIDEO_ID}` }
    const inFlight = Array.from({ length: 10 }, () =>
      worker.fetch(captureRequest(input), env),
    )
    for (let i = 0; i < 100 && context.newPage.mock.calls.length < 10; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
    expect(context.newPage).toHaveBeenCalledTimes(10)
    const extra = await worker.fetch(captureRequest(input), env)
    expect(extra.status).toBe(429)
    expect(context.newPage).toHaveBeenCalledTimes(10)
    resume.forEach((resolve) => resolve())
    const responses = await Promise.all(inFlight)
    expect(responses.every((response) => response.status === 200)).toBe(true)
    page.waitForFunction.mockResolvedValue(undefined)
    const afterRelease = await worker.fetch(captureRequest(input), env)
    expect(afterRelease.status).toBe(200)
  })

  it("does not write a file when YouTube reports an embed error", async () => {
    const { bucket, env } = setup()
    const { context } = mockBrowser({
      ready: false,
      error: "YouTube player error 150",
      time: null,
    })
    const response = await worker.fetch(
      captureRequest({ youtubeUrl: `https://youtu.be/${VIDEO_ID}?t=90` }),
      env,
    )
    expect(response.status).toBe(422)
    expect(bucket.objects.size).toBe(0)
    expect(context.close).toHaveBeenCalledOnce()
  })

  it("returns a timeout and releases the tab when the frame never appears", async () => {
    const { bucket, env } = setup("1")
    const { context, page } = mockBrowser()
    page.waitForFunction.mockRejectedValue(
      new Error("Timed out after 20000 ms"),
    )
    const response = await worker.fetch(
      captureRequest({ youtubeUrl: `https://youtu.be/${VIDEO_ID}?t=90` }),
      env,
    )
    expect(response.status).toBe(504)
    expect(bucket.objects.size).toBe(0)
    expect(context.close).toHaveBeenCalledOnce()
    const retry = await worker.fetch(
      captureRequest({ youtubeUrl: `https://youtu.be/${VIDEO_ID}` }),
      env,
    )
    expect(retry.status).toBe(504)
    expect(context.newPage).toHaveBeenCalledTimes(2)
  })

  it("releases the tab when R2 rejects the PNG write", async () => {
    const { bucket, env } = setup("1")
    const { context } = mockBrowser()
    const put = vi
      .spyOn(bucket, "put")
      .mockRejectedValueOnce(new Error("R2 unavailable"))
    const input = { youtubeUrl: `https://youtu.be/${VIDEO_ID}` }
    const failed = await worker.fetch(captureRequest(input), env)
    expect(failed.status).toBe(502)
    expect(context.close).toHaveBeenCalledOnce()
    expect(bucket.objects.size).toBe(0)
    put.mockRestore()
    const retry = await worker.fetch(captureRequest(input), env)
    expect(retry.status).toBe(200)
  })
})
