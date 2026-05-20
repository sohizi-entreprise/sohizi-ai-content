import { Elysia, sse } from 'elysia'
import { z } from 'zod'
import * as aiService from './service'
import { assertProjectAccess } from '@/lib/authorize'
import { authMiddleware } from '@/lib/auth-middleware'

const projectParams = z.object({
    projectId: z.uuid('Invalid project id'),
})

export const aiRoutes = new Elysia({ prefix: '/projects/:projectId/ai' })
  .guard({
    params: projectParams,
  })
  .use(authMiddleware)
  .post('/chat', async function*({params, body, user}) {
    await assertProjectAccess(user.id, params.projectId)
    const payload = {
        projectId: params.projectId,
        ...body,
    }
    const generator = await aiService.handleChat(payload)
    for await (const chunk of generator) {
      yield sse({
        event: chunk.type,
        data: JSON.stringify(chunk),
      })
    }
  }, {
    body: z.object({
      userPrompt: z.string(),
      modelId: z.string(),
    })
  })