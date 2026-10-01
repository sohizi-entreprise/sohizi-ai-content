import { handleAudioTrim } from "./audio/handler"
import { errorResponse, json } from "./http"
import type { WorkerEnv } from "./env"

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url)

    try {
      if (url.pathname === "/v1/health") {
        return json({ ok: true })
      }

      return await handleAudioTrim(request, env)
    } catch (error) {
      return errorResponse(error)
    }
  },
}
