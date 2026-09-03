import http from "node:http"
import { createReadStream } from "node:fs"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { pipeline } from "node:stream/promises"
import {
  makeCancelSignal,
  renderMedia,
  selectComposition,
} from "@remotion/renderer"
import { isRenderInputDocument } from "./protocol.js"
import type { IncomingMessage, ServerResponse } from "node:http"
import type {
  RenderInputDocument,
  RenderState,
  RenderStatusResponse,
} from "./protocol.js"

const PORT = Number(process.env.PORT ?? 8080)
const COMPOSITION_ID = "main"
const BUNDLE_DIR = process.env.REMOTION_BUNDLE_DIR ?? "/app/remotion-bundle"
const RENDER_TOKEN = process.env.RENDER_TOKEN ?? ""
const CONCURRENCY = clampInt(process.env.RENDER_CONCURRENCY, 2, 1, 16)
const TIMEOUT_MS =
  clampInt(process.env.RENDER_TIMEOUT_MINUTES, 30, 1, 240) * 60 * 1000
/** Guard rail matching the Worker's payload limit. */
const MAX_BODY_BYTES = 8 * 1024 * 1024
/** Hyperframe clips block on an iframe load, so allow more than the 30s default. */
const DELAY_RENDER_TIMEOUT_MS = 90_000

function clampInt(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(parsed)))
}

type Job = {
  id: string
  state: RenderState
  progress: number
  renderedFrames: number
  encodedFrames: number
  outputPath: string
  sizeInBytes?: number
  error?: { code: string; message: string; retryable?: boolean }
  cancel: () => void
  timer?: NodeJS.Timeout
}

const jobs = new Map<string, Job>()
let workDir: string | null = null
let shuttingDown = false

async function getWorkDir(): Promise<string> {
  if (!workDir) {
    workDir = await fs.mkdtemp(path.join(os.tmpdir(), "sohizi-render-"))
  }
  return workDir
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
  })
  res.end(payload)
}

function toStatusResponse(job: Job): RenderStatusResponse {
  return {
    jobId: job.id,
    state: job.state,
    progress: job.progress,
    renderedFrames: job.renderedFrames,
    encodedFrames: job.encodedFrames,
    ...(job.sizeInBytes === undefined ? {} : { sizeInBytes: job.sizeInBytes }),
    ...(job.error ? { error: job.error } : {}),
  }
}

function isAuthorized(req: IncomingMessage): boolean {
  if (!RENDER_TOKEN) return true
  const header = req.headers.authorization ?? ""
  const [scheme, token] = header.split(" ")
  return scheme?.toLowerCase() === "bearer" && token === RENDER_TOKEN
}

async function readBody(req: IncomingMessage): Promise<RenderInputDocument> {
  const chunks: Array<Buffer> = []
  let size = 0
  for await (const chunk of req) {
    const buffer = chunk as Buffer
    size += buffer.byteLength
    if (size > MAX_BODY_BYTES) {
      throw new HttpFailure(
        413,
        "payload_too_large",
        "Render payload too large",
      )
    }
    chunks.push(buffer)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"))
  } catch {
    throw new HttpFailure(400, "bad_request", "Body must be JSON")
  }

  if (!isRenderInputDocument(parsed)) {
    throw new HttpFailure(400, "bad_request", "Invalid render input document")
  }
  return parsed
}

class HttpFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = "HttpFailure"
  }
}

async function startRender(input: RenderInputDocument): Promise<Job> {
  const dir = await getWorkDir()
  const outputPath = path.join(dir, `${input.jobId}.mp4`)
  const { cancelSignal, cancel } = makeCancelSignal()

  const job: Job = {
    id: input.jobId,
    state: "running",
    progress: 0,
    renderedFrames: 0,
    encodedFrames: 0,
    outputPath,
    cancel,
  }
  jobs.set(job.id, job)

  job.timer = setTimeout(() => {
    if (job.state === "running") {
      job.error = {
        code: "timeout",
        message: `Render exceeded ${TIMEOUT_MS / 60_000} minutes`,
        retryable: false,
      }
      cancel()
    }
  }, TIMEOUT_MS)

  const inputProps = {
    tracks: input.composition.tracks,
    fps: input.composition.fps,
    width: input.composition.width,
    height: input.composition.height,
    durationInFrames: input.composition.durationInFrames,
  }

  void (async () => {
    try {
      const composition = await selectComposition({
        serveUrl: BUNDLE_DIR,
        id: COMPOSITION_ID,
        inputProps,
        logLevel: "warn",
      })

      await renderMedia({
        composition,
        serveUrl: BUNDLE_DIR,
        codec: "h264",
        audioCodec: "aac",
        pixelFormat: "yuv420p",
        crf: 23,
        outputLocation: outputPath,
        inputProps,
        concurrency: CONCURRENCY,
        // Required for Chrome Headless Shell in a container.
        chromiumOptions: { enableMultiProcessOnLinux: true },
        timeoutInMilliseconds: DELAY_RENDER_TIMEOUT_MS,
        // Guarantees an audio track even for silent timelines, so downstream
        // players and muxers behave consistently.
        enforceAudioTrack: true,
        logLevel: "warn",
        cancelSignal,
        onProgress: ({ progress, renderedFrames, encodedFrames }) => {
          job.progress = progress
          job.renderedFrames = renderedFrames
          job.encodedFrames = encodedFrames
        },
      })

      const stat = await fs.stat(outputPath)
      job.sizeInBytes = stat.size
      job.progress = 1
      job.state = "completed"
      console.log(`[render] ${job.id} completed (${stat.size} bytes)`)
    } catch (error) {
      job.state = "failed"
      job.error ??= {
        code: "render_failed",
        message:
          error instanceof Error ? error.message : "Unknown render error",
        // Chrome/ffmpeg crashes are worth one more attempt; validation and
        // asset problems are not, and those surface as delayRender errors.
        retryable: !isDeterministicFailure(error),
      }
      console.error(`[render] ${job.id} failed:`, error)
      await fs.rm(outputPath, { force: true }).catch(() => undefined)
    } finally {
      if (job.timer) clearTimeout(job.timer)
    }
  })()

  return job
}

function isDeterministicFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes("delayRender") ||
    message.includes("Failed to fetch") ||
    message.includes("does not exist") ||
    message.includes("Cannot find composition") ||
    message.includes("Error in") ||
    message.includes("exceeded")
  )
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = new URL(req.url ?? "/", "http://render.internal")
  const segments = url.pathname.split("/").filter(Boolean)

  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, {
      ok: true,
      bundleDir: BUNDLE_DIR,
      concurrency: CONCURRENCY,
      activeJobs: [...jobs.values()].filter((job) => job.state === "running")
        .length,
    })
    return
  }

  if (!isAuthorized(req)) {
    sendJson(res, 401, {
      error: { code: "unauthorized", message: "Invalid token" },
    })
    return
  }

  if (shuttingDown) {
    sendJson(res, 503, {
      error: { code: "shutting_down", message: "Container is shutting down" },
    })
    return
  }

  if (req.method === "POST" && url.pathname === "/renders") {
    const input = await readBody(req)

    const existing = jobs.get(input.jobId)
    if (existing) {
      sendJson(res, 200, toStatusResponse(existing))
      return
    }

    const running = [...jobs.values()].find((job) => job.state === "running")
    if (running) {
      throw new HttpFailure(
        409,
        "busy",
        `Container is already rendering ${running.id}`,
      )
    }

    const job = await startRender(input)
    sendJson(res, 202, toStatusResponse(job))
    return
  }

  if (segments[0] === "renders" && segments[1]) {
    const job = jobs.get(segments[1])

    if (req.method === "DELETE") {
      if (job) await removeJob(job)
      sendJson(res, 200, { deleted: true })
      return
    }

    if (!job) {
      throw new HttpFailure(404, "not_found", "Unknown render job")
    }

    if (req.method === "GET" && segments.length === 2) {
      sendJson(res, 200, toStatusResponse(job))
      return
    }

    if (req.method === "GET" && segments[2] === "output") {
      if (job.state !== "completed" || job.sizeInBytes === undefined) {
        throw new HttpFailure(409, "not_ready", "Render is not complete")
      }
      res.writeHead(200, {
        "Content-Type": "video/mp4",
        "Content-Length": job.sizeInBytes,
      })
      await pipeline(createReadStream(job.outputPath), res)
      return
    }
  }

  throw new HttpFailure(404, "not_found", "Unknown route")
}

async function removeJob(job: Job): Promise<void> {
  if (job.state === "running") job.cancel()
  if (job.timer) clearTimeout(job.timer)
  jobs.delete(job.id)
  await fs.rm(job.outputPath, { force: true }).catch(() => undefined)
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((error: unknown) => {
    if (res.headersSent) {
      res.destroy()
      return
    }
    if (error instanceof HttpFailure) {
      sendJson(res, error.status, {
        error: { code: error.code, message: error.message },
      })
      return
    }
    console.error("[render] request failed:", error)
    sendJson(res, 500, {
      error: { code: "internal_error", message: "Render service error" },
    })
  })
})

server.headersTimeout = 60_000
// Bounds how long the *request* may take to arrive, so a stalled upload cannot
// wedge the single-render container. Response streaming is unaffected, so
// downloads of a finished render are never cut off mid-stream.
server.requestTimeout = 120_000

server.listen(PORT, () => {
  console.log(`[render] listening on :${PORT} (concurrency=${CONCURRENCY})`)
})

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`[render] received ${signal}, shutting down`)

  for (const job of jobs.values()) {
    if (job.state === "running") job.cancel()
    if (job.timer) clearTimeout(job.timer)
  }

  await new Promise<void>((resolve) => server.close(() => resolve()))
  if (workDir) {
    await fs
      .rm(workDir, { recursive: true, force: true })
      .catch(() => undefined)
  }
  process.exit(0)
}

process.on("SIGTERM", () => void shutdown("SIGTERM"))
process.on("SIGINT", () => void shutdown("SIGINT"))
process.on("unhandledRejection", (reason) => {
  console.error("[render] unhandled rejection:", reason)
})
