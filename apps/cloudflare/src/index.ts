import { handleAudioTrim } from "./audio/handler"
import { errorResponse, json } from "./http"
import { handlePlayer, handleYoutubeScreenshot } from "./youtube/handler"
import type { WorkerEnv } from "./env"

export { YoutubeBrowserPool } from "./youtube/browser-pool"

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url)

    try {
      if (url.pathname === "/v1/health") {
        return json({ ok: true })
      }

      if (url.pathname === "/v1/youtube-screenshots/player") {
        return handlePlayer(request)
      }

      if (url.pathname === "/v1/youtube-screenshots") {
        return await handleYoutubeScreenshot(request, env)
      }

      if (url.pathname === "/" || url.pathname === "/trim") {
        return await handleAudioTrim(request, env)
      }

      return new Response("Not found", { status: 404 })
    } catch (error) {
      return errorResponse(error)
    }
  },
}
