import { Elysia, sse } from 'elysia'
import { z } from 'zod'
import * as aiService from './service'

const projectParams = z.object({
    projectId: z.uuid('Invalid project id'),
})

export const aiRoutes = new Elysia({ prefix: '/projects/:projectId/ai' })
  .guard({
    params: projectParams
  })
  .post('/chat', async function*({params, body}) {
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