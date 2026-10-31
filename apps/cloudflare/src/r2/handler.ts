import { HttpError, json } from "../http"
import type { WorkerEnv } from "../env"

const FETCH_TIMEOUT_MS = 120_000

export type UploadFromUrlInput = {
  sourceUrl: string
  destinationPath?: string
}

type AssetFolder = "images" | "videos" | "audios" | "documents" | "htmls"
type AssetType = "image" | "video" | "audio" | "document" | "html"

const EXTENSION_TO_FOLDER: Record<string, AssetFolder> = {
  png: "images",
  jpg: "images",
  jpeg: "images",
  webp: "images",
  gif: "images",
  bmp: "images",
  svg: "images",
  avif: "images",
  mp4: "videos",
  webm: "videos",
  mov: "videos",
  m4v: "videos",
  avi: "videos",
  mkv: "videos",
  mp3: "audios",
  wav: "audios",
  ogg: "audios",
  m4a: "audios",
  aac: "audios",
  flac: "audios",
  weba: "audios",
  html: "htmls",
  htm: "htmls",
}

const FOLDER_TO_ASSET_TYPE: Record<AssetFolder, AssetType> = {
  images: "image",
  videos: "video",
  audios: "audio",
  documents: "document",
  htmls: "html",
}

const FOLDER_DEFAULT_EXT: Record<AssetFolder, string> = {
  images: "png",
  videos: "mp4",
  audios: "mp3",
  documents: "bin",
  htmls: "html",
}

const EXTENSION_TO_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  avif: "image/avif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  m4v: "video/x-m4v",
  avi: "video/x-msvideo",
  mkv: "video/x-matroska",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  flac: "audio/flac",
  weba: "audio/webm",
  html: "text/html",
  htm: "text/html",
}

function getAssetFolder(contentType: string): AssetFolder {
  if (contentType.startsWith("image/")) return "images"
  if (contentType.startsWith("video/")) return "videos"
  if (contentType.startsWith("audio/")) return "audios"
  if (contentType === "text/html" || contentType.startsWith("text/html"))
    return "htmls"
  return "documents"
}

function extFromUrl(sourceUrl: string): string | null {
  try {
    const pathname = new URL(sourceUrl).pathname
    const lastSegment = pathname.split("/").pop() ?? ""
    if (!lastSegment.includes(".")) return null
    return lastSegment.split(".").pop()?.toLowerCase() ?? null
  } catch {
    return null
  }
}

function folderFromUrl(sourceUrl: string): AssetFolder | null {
  const ext = extFromUrl(sourceUrl)
  if (!ext) return null
  return EXTENSION_TO_FOLDER[ext] ?? null
}

function resolveContentType(
  headerContentType: string | null,
  sourceUrl: string,
): string {
  const cleaned = headerContentType?.split(";")[0]?.trim().toLowerCase() ?? ""
  if (
    cleaned &&
    cleaned !== "application/octet-stream" &&
    cleaned !== "binary/octet-stream"
  ) {
    return cleaned
  }
  const ext = extFromUrl(sourceUrl)
  if (ext && EXTENSION_TO_MIME[ext]) {
    return EXTENSION_TO_MIME[ext]
  }
  return cleaned || "application/octet-stream"
}

function resolveAssetFolder(
  contentType: string,
  sourceUrl: string,
): AssetFolder {
  const fromType = getAssetFolder(contentType)
  if (fromType !== "documents") return fromType
  return folderFromUrl(sourceUrl) ?? fromType
}

function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[/\\\s]+/g, "-")
    .toLowerCase()
    .trim()
}

function fileNameFromSource(sourceUrl: string, folder: AssetFolder): string {
  try {
    const name = decodeURIComponent(
      new URL(sourceUrl).pathname.split("/").pop() ?? "",
    )
    const sanitized = sanitizeFileName(name)
    if (sanitized && sanitized !== "-") return sanitized
  } catch {
    // fall through to generated name
  }
  return `${FOLDER_TO_ASSET_TYPE[folder]}-${crypto.randomUUID().slice(0, 8)}.${FOLDER_DEFAULT_EXT[folder]}`
}

function buildStoragePath(folder: AssetFolder, filename: string): string {
  const key = crypto.randomUUID()
  return `${folder}/${key}/${sanitizeFileName(filename)}`
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

function parseUploadInput(body: unknown): UploadFromUrlInput {
  if (!body || typeof body !== "object") {
    throw new HttpError("bad_request", "Invalid request body")
  }
  const record = body as { sourceUrl?: unknown; destinationPath?: unknown }
  if (
    typeof record.sourceUrl !== "string" ||
    record.sourceUrl.trim().length === 0
  ) {
    throw new HttpError("bad_request", "sourceUrl is required")
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(record.sourceUrl)
  } catch {
    throw new HttpError("bad_request", "Invalid sourceUrl")
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new HttpError(
      "bad_request",
      "sourceUrl must use http or https protocol",
    )
  }

  let destinationPath: string | undefined
  if (record.destinationPath !== undefined) {
    if (
      typeof record.destinationPath !== "string" ||
      record.destinationPath.trim().length === 0 ||
      record.destinationPath.startsWith("/") ||
      record.destinationPath.includes("..")
    ) {
      throw new HttpError("bad_request", "Invalid destinationPath")
    }
    destinationPath = record.destinationPath.trim()
  }

  return {
    sourceUrl: parsedUrl.toString(),
    destinationPath,
  }
}

export async function handleUploadFromUrl(
  request: Request,
  env: WorkerEnv,
): Promise<Response> {
  if (request.method !== "POST") {
    throw new HttpError("method_not_allowed", "Method not allowed")
  }
  if (!env.CLOUDFLARE_WORKER_TOKEN) {
    throw new HttpError("internal_error", "Worker token is not configured")
  }
  if (
    request.headers.get("Authorization") !==
    `Bearer ${env.CLOUDFLARE_WORKER_TOKEN}`
  ) {
    throw new HttpError("unauthorized", "Unauthorized")
  }

  const baseUrl = publicBaseUrl(env)

  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    throw new HttpError("bad_request", "Invalid JSON body")
  }

  const { sourceUrl, destinationPath } = parseUploadInput(rawBody)

  let upstream: Response
  try {
    upstream = await fetch(sourceUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/timeout|timed out|abort/i.test(message)) {
      throw new HttpError("timeout", `Timed out fetching from ${sourceUrl}`)
    }
    throw new HttpError("upstream_error", `Failed to fetch from ${sourceUrl}`)
  }

  if (!upstream.ok || !upstream.body) {
    await upstream.body?.cancel().catch(() => {})
    throw new HttpError(
      "upstream_error",
      `Failed to download from ${sourceUrl}: ${upstream.statusText || upstream.status}`,
    )
  }

  const contentType = resolveContentType(
    upstream.headers.get("content-type"),
    sourceUrl,
  )
  const folder = resolveAssetFolder(contentType, sourceUrl)
  const storageKey =
    destinationPath ??
    buildStoragePath(folder, fileNameFromSource(sourceUrl, folder))

  const contentLengthHeader = upstream.headers.get("content-length")
  const parsedContentLength =
    contentLengthHeader !== null && contentLengthHeader.trim() !== ""
      ? Number(contentLengthHeader)
      : Number.NaN
  const hasContentEncoding = Boolean(upstream.headers.get("content-encoding"))
  const canStreamFixedLength =
    !hasContentEncoding &&
    Number.isSafeInteger(parsedContentLength) &&
    parsedContentLength >= 0

  let bodyToPut: ReadableStream | ArrayBuffer
  let fallbackSize: number

  if (canStreamFixedLength) {
    // Cloudflare R2 requires ReadableStreams passed to .put() to have a known length.
    bodyToPut =
      typeof FixedLengthStream !== "undefined"
        ? upstream.body.pipeThrough(new FixedLengthStream(parsedContentLength))
        : upstream.body
    fallbackSize = parsedContentLength
  } else {
    // When Content-Length is absent (chunked transfer) or Content-Encoding is set,
    // R2.put() cannot accept an unknown-length ReadableStream in workerd.
    const buffer = await upstream.arrayBuffer()
    bodyToPut = buffer
    fallbackSize = buffer.byteLength
  }

  let stored: R2Object | null
  try {
    stored = await env.R2_BUCKET.put(storageKey, bodyToPut, {
      httpMetadata: { contentType },
    })
  } catch (error) {
    console.error("[r2-upload] failed to write to R2:", error)
    throw new HttpError("upstream_error", "Failed to store object in R2")
  }

  const size = stored?.size ?? fallbackSize

  return json({
    url: `${baseUrl}/${storageKey}`,
    storageKey,
    size,
    contentType,
    type: FOLDER_TO_ASSET_TYPE[folder],
  })
}
