/**
 * MP3 frame trimmer backed by R2.
 *
 * Example request:
 *   /?key=audio/example.mp3&offset=30&duration=15
 *   /trim?key=audio/example.mp3&offset=30&duration=15
 *
 * Returns audio/mpeg containing whole MP3 frames, so the result stays
 * playable without re-encoding.
 */

import {
  getAudioEnd,
  looksLikeNextFrame,
  parseFrameHeader,
  parseNonNegativeNumber,
  parsePositiveNumber,
  skipID3v2Tag,
} from "./mp3"
import { textResponse } from "../http"
import type { WorkerEnv } from "../env"

const DEFAULT_MAX_MP3_BYTES = 10 * 1024 * 1024 // 10 MB

function badRequest(message: string): Response {
  return textResponse(message, 400)
}

export async function handleAudioTrim(
  request: Request,
  env: WorkerEnv,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return textResponse("Method not allowed", 405, { Allow: "GET, HEAD" })
  }

  const url = new URL(request.url)

  const key = url.searchParams.get("key")
  if (!key) {
    return badRequest('Missing "key" query parameter')
  }

  const offset = parseNonNegativeNumber(url.searchParams.get("offset") ?? "0")
  if (offset === null) {
    return badRequest('"offset" must be a non-negative number')
  }

  const durationParam = url.searchParams.get("duration")
  const duration =
    durationParam === null ? null : parsePositiveNumber(durationParam)

  if (durationParam !== null && duration === null) {
    return badRequest('"duration" must be a positive number')
  }

  const object = await env.R2_BUCKET?.get(key)

  if (!object) {
    return textResponse("File not found in R2", 404)
  }

  const maxBytes = Number(env.MAX_MP3_BYTES ?? DEFAULT_MAX_MP3_BYTES)

  if (object.size > maxBytes) {
    return textResponse("MP3 too large for in-memory trimming", 413)
  }

  const bytes = new Uint8Array(await object.arrayBuffer())

  const audioStart = skipID3v2Tag(bytes)
  const audioEnd = getAudioEnd(bytes)

  if (audioStart >= audioEnd) {
    return badRequest("No MP3 audio data found")
  }

  let pos = audioStart
  let currentTime = 0

  let startByte = -1
  let endByte = -1

  const targetEnd = duration === null ? null : offset + duration

  while (pos + 4 <= audioEnd) {
    const frame = parseFrameHeader(bytes[pos], bytes[pos + 1], bytes[pos + 2])

    if (
      !frame ||
      pos + frame.frameSize > audioEnd ||
      !looksLikeNextFrame(bytes, pos, frame.frameSize, audioEnd)
    ) {
      // Not a valid frame at this position. Move forward and try to resync.
      pos++
      continue
    }

    const nextTime = currentTime + frame.duration

    if (startByte === -1 && nextTime > offset) {
      startByte = pos
    }

    if (targetEnd !== null && startByte !== -1 && nextTime >= targetEnd) {
      endByte = pos + frame.frameSize
      break
    }

    currentTime = nextTime
    pos += frame.frameSize
  }

  if (startByte === -1) {
    return badRequest("Offset exceeds audio duration")
  }

  if (endByte === -1) {
    endByte = audioEnd
  }

  const trimmed = bytes.subarray(startByte, endByte)

  const headers = new Headers()

  headers.set("Content-Type", "audio/mpeg")
  headers.set("Content-Length", String(trimmed.byteLength))

  // Adjust this depending on whether the source files are private/user-specific.
  headers.set("Cache-Control", "public, max-age=31536000, immutable")

  if (request.method === "HEAD") {
    return new Response(null, { headers })
  }

  return new Response(trimmed, { headers })
}
