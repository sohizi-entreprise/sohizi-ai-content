import { ContainerProxy } from '@cloudflare/containers'
import { handleAudioTrim } from './audio/handler'
import { errorResponse, json } from './http'
import { handleRenderRoute, isRenderRoute } from './render/routes'
import type { WorkerEnv } from './env'

export { RemotionRenderContainer } from './render/container'
export { RenderWorkflow } from './render/workflow'
export { ContainerProxy }

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url)

    try {
      if (url.pathname === '/v1/health') {
        return json({ ok: true })
      }

      if (isRenderRoute(url.pathname)) {
        return await handleRenderRoute(request, env)
      }

      // `/` keeps the original audio trimming contract the API already calls.
      return await handleAudioTrim(request, env)
    } catch (error) {
      return errorResponse(error)
    }
  },
}
