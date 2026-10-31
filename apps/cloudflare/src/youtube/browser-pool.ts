import puppeteer, {
  type Browser,
  type BrowserContext,
} from "@cloudflare/puppeteer"
import { errorResponse, HttpError, json } from "../http"
import type { WorkerEnv } from "../env"
import { parsePlayerParams } from "./parse"

const NAVIGATION_TIMEOUT_MS = 10_000
const CAPTURE_TIMEOUT_MS = 20_000
const SESSION_KEY = "sessionId"

type CaptureState = {
  ready: boolean
  error: string | null
  time: number | null
}

export function maxTabsPerBrowser(value: string | number | undefined): number {
  const max = Number(value ?? 10)
  if (!Number.isInteger(max) || max < 1 || max > 100) {
    throw new HttpError("internal_error", "Invalid browser tab limit")
  }
  return max
}

function publicBaseUrl(env: WorkerEnv): string {
  if (!env.R2_PUBLIC_URL) {
    throw new HttpError("internal_error", "R2 public URL is not configured")
  }
  let url: URL
  try {
    url = new URL(env.R2_PUBLIC_URL)
  } catch {
    throw new HttpError("internal_error", "R2 public URL is invalid")
  }
  if (url.protocol !== "https:") {
    throw new HttpError("internal_error", "R2 public URL must be HTTPS")
  }
  return url.toString().replace(/\/$/, "")
}

export class YoutubeBrowserPool {
  private browser?: Browser
  private launchPromise?: Promise<Browser>
  private activeTabs = 0

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: WorkerEnv,
  ) {}

  async fetch(request: Request): Promise<Response> {
    try {
      if (
        request.method !== "POST" ||
        new URL(request.url).pathname !== "/capture"
      ) {
        throw new HttpError("not_found", "Not found")
      }
      const body = (await request.json()) as {
        playerUrl?: unknown
        seconds?: unknown
      }
      if (
        typeof body.playerUrl !== "string" ||
        typeof body.seconds !== "number"
      ) {
        throw new HttpError("bad_request", "Invalid capture request")
      }
      const playerUrl = new URL(body.playerUrl)
      const input = parsePlayerParams(playerUrl)
      if (
        playerUrl.protocol !== "https:" ||
        playerUrl.pathname !== "/v1/youtube-screenshots/player" ||
        input.seconds !== body.seconds
      ) {
        throw new HttpError("bad_request", "Invalid player URL")
      }
      return await this.capture(playerUrl, input.seconds)
    } catch (error) {
      return errorResponse(error)
    }
  }

  private async connectOrLaunch(): Promise<Browser> {
    const sessionId = await this.state.storage.get<string>(SESSION_KEY)
    if (sessionId) {
      try {
        const browser = await puppeteer.connect(this.env.BROWSER, sessionId)
        // Requests from a previous Durable Object instance cannot still be live.
        for (const context of browser.browserContexts()) {
          if (context !== browser.defaultBrowserContext()) await context.close()
        }
        this.browser = browser
        return browser
      } catch (error) {
        console.warn("[youtube-screenshot] could not reconnect browser", error)
        await this.state.storage.delete(SESSION_KEY)
      }
    }
    const browser = await puppeteer.launch(this.env.BROWSER)
    this.browser = browser
    await this.state.storage.put(SESSION_KEY, browser.sessionId())
    return browser
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser?.isConnected()) return this.browser
    this.launchPromise ??= this.connectOrLaunch().finally(() => {
      this.launchPromise = undefined
    })
    return this.launchPromise
  }

  private async capture(playerUrl: URL, seconds: number): Promise<Response> {
    const baseUrl = publicBaseUrl(this.env)
    const maxTabs = maxTabsPerBrowser(this.env.YOUTUBE_SCREENSHOT_MAX_TABS)
    if (this.activeTabs >= maxTabs) {
      throw new HttpError("rate_limited", "All screenshot tabs are busy")
    }
    // Reserve before any await; Durable Object requests can interleave during I/O.
    this.activeTabs++
    let context: BrowserContext | undefined
    try {
      const browser = await this.getBrowser()
      context = await browser.createBrowserContext()
      const page = await context.newPage()
      await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 })
      await page.goto(playerUrl.toString(), {
        waitUntil: "domcontentloaded",
        timeout: NAVIGATION_TIMEOUT_MS,
      })
      await page.waitForFunction(
        () =>
          Boolean(
            (globalThis as typeof globalThis & { capture?: CaptureState })
              .capture?.ready ||
            (globalThis as typeof globalThis & { capture?: CaptureState })
              .capture?.error,
          ),
        { timeout: CAPTURE_TIMEOUT_MS },
      )
      const capture = await page.evaluate(
        () =>
          (globalThis as typeof globalThis & { capture?: CaptureState })
            .capture,
      )
      if (capture?.error) throw new HttpError("unprocessable", capture.error)
      if (!capture?.ready || capture.time === null) {
        throw new HttpError(
          "upstream_error",
          "YouTube player did not load a frame",
        )
      }
      const iframe = await page.$("iframe")
      if (!iframe) {
        throw new HttpError("upstream_error", "YouTube iframe was not rendered")
      }
      const png = await iframe.screenshot({ type: "png" })
      const id = crypto.randomUUID()
      const key = `youtube_extractions/${id}.png`
      await this.env.R2_BUCKET.put(key, png, {
        httpMetadata: { contentType: "image/png" },
      })
      return json({
        id,
        url: `${baseUrl}/${key}`,
        requestedSeconds: seconds,
        capturedSeconds: capture.time,
      })
    } catch (error) {
      if (error instanceof HttpError) throw error
      console.error("[youtube-screenshot] capture failed:", error)
      const message = error instanceof Error ? error.message : String(error)
      if (/429|too many requests|rate limit/i.test(message)) {
        throw new HttpError(
          "rate_limited",
          "Browser capacity reached; retry later",
        )
      }
      if (/timeout|timed out/i.test(message)) {
        throw new HttpError("timeout", "Timed out waiting for a YouTube frame")
      }
      throw new HttpError(
        "upstream_error",
        "Could not capture the YouTube frame",
      )
    } finally {
      try {
        await context?.close()
      } catch (error) {
        console.error("[youtube-screenshot] could not close context:", error)
      } finally {
        this.activeTabs--
      }
    }
  }
}
