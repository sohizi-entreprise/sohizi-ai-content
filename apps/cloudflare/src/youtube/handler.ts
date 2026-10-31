import { HttpError } from "../http"
import type { WorkerEnv } from "../env"
import { parsePlayerParams, parseYoutubeCaptureInput } from "./parse"
import { playerHtml } from "./player"

const PLAYER_PATH = "/v1/youtube-screenshots/player"

export function handlePlayer(request: Request): Response {
  if (request.method !== "GET") {
    throw new HttpError("method_not_allowed", "Method not allowed")
  }
  const input = parsePlayerParams(new URL(request.url))
  return new Response(playerHtml(input), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  })
}

export async function handleYoutubeScreenshot(
  request: Request,
  env: WorkerEnv,
): Promise<Response> {
  if (request.method !== "POST") {
    throw new HttpError("method_not_allowed", "Method not allowed")
  }
  if (!env.YOUTUBE_SCREENSHOT_TOKEN) {
    throw new HttpError("internal_error", "Screenshot token is not configured")
  }
  if (
    request.headers.get("Authorization") !==
    `Bearer ${env.YOUTUBE_SCREENSHOT_TOKEN}`
  ) {
    throw new HttpError("unauthorized", "Unauthorized")
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    throw new HttpError("bad_request", "Invalid JSON body")
  }
  const { videoId, seconds } = parseYoutubeCaptureInput(body)
  const playerUrl = new URL(PLAYER_PATH, request.url)
  playerUrl.searchParams.set("id", videoId)
  playerUrl.searchParams.set("seconds", String(seconds))

  const pool = env.YOUTUBE_BROWSER_POOL.getByName("primary")
  return pool.fetch(
    new Request("https://browser-pool.internal/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerUrl: playerUrl.toString(), seconds }),
    }),
  )
}
