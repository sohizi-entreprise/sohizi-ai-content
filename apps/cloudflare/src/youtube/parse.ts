import { HttpError } from "../http"

export type YoutubeCaptureInput = {
  videoId: string
  seconds: number
}

const MAX_SECONDS = 86400
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/

function parseTime(value: string): number | null {
  if (/^\d+s?$/.test(value)) return Number(value.replace(/s$/, ""))

  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value)
  if (!match || (!match[1] && !match[2] && !match[3])) return null

  return (
    Number(match[1] ?? 0) * 3600 +
    Number(match[2] ?? 0) * 60 +
    Number(match[3] ?? 0)
  )
}

export function parseYoutubeCaptureInput(input: unknown): YoutubeCaptureInput {
  if (!input || typeof input !== "object") {
    throw new HttpError("bad_request", "Expected a JSON object")
  }

  const { youtubeUrl, seconds: explicitSeconds } = input as Record<
    string,
    unknown
  >
  if (typeof youtubeUrl !== "string") {
    throw new HttpError("bad_request", "youtubeUrl is required")
  }

  let url: URL
  try {
    url = new URL(youtubeUrl)
  } catch {
    throw new HttpError("bad_request", "Invalid YouTube URL")
  }

  if (url.protocol !== "https:" || url.username || url.password) {
    throw new HttpError("bad_request", "Invalid YouTube URL")
  }

  let videoId: string | null | undefined
  if (url.hostname === "youtu.be") {
    videoId = url.pathname.slice(1)
  } else if (
    url.hostname === "youtube.com" ||
    url.hostname === "www.youtube.com" ||
    url.hostname === "m.youtube.com"
  ) {
    videoId =
      url.pathname === "/watch"
        ? url.searchParams.get("v")
        : url.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)\/?$/)?.[1]
  }

  if (!videoId || !VIDEO_ID.test(videoId)) {
    throw new HttpError("bad_request", "Invalid YouTube URL")
  }

  const urlTime = url.searchParams.get("t") ?? url.searchParams.get("start")
  const seconds =
    explicitSeconds === undefined
      ? urlTime === null
        ? 0
        : parseTime(urlTime)
      : explicitSeconds

  if (
    typeof seconds !== "number" ||
    !Number.isInteger(seconds) ||
    seconds < 0 ||
    seconds > MAX_SECONDS
  ) {
    throw new HttpError(
      "bad_request",
      "seconds must be an integer from 0 to 86400, or supplied by the YouTube URL",
    )
  }

  return { videoId, seconds }
}

export function parsePlayerParams(url: URL): YoutubeCaptureInput {
  const videoId = url.searchParams.get("id")
  const rawSeconds = url.searchParams.get("seconds")
  const seconds = Number(rawSeconds)
  if (
    !videoId ||
    rawSeconds === null ||
    rawSeconds === "" ||
    !VIDEO_ID.test(videoId) ||
    !Number.isInteger(seconds) ||
    seconds < 0 ||
    seconds > MAX_SECONDS
  ) {
    throw new HttpError("bad_request", "Invalid player parameters")
  }
  return { videoId, seconds }
}
