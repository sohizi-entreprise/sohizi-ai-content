import { errorResponse } from "../http"
import type { YoutubeEnv } from "../env"
import { handlePlayer, handleYoutubeScreenshot } from "./handler"

export { YoutubeBrowserPool } from "./browser-pool"

export default {
  async fetch(request: Request, env: YoutubeEnv): Promise<Response> {
    const url = new URL(request.url)
    try {
      if (url.pathname === "/v1/youtube-screenshots/player") {
        return handlePlayer(request)
      }
      if (url.pathname === "/v1/youtube-screenshots") {
        return await handleYoutubeScreenshot(request, env)
      }
      return new Response("Not found", { status: 404 })
    } catch (error) {
      return errorResponse(error)
    }
  },
}
