import * as aiService from './service'
import { Elysia, sse } from 'elysia'
import { z } from 'zod'


export const aiRoutes = new Elysia({ prefix: '/ai' })
  .post('/brief/project/:id', async function*({ params }){
    const streams = await aiService.generateBrief(params.id)
    for await (const chunk of streams) {
      yield sse({
        data: chunk,
        event: 'message',
      })
    }
  }, {
    params: z.object({
      id: z.uuid("Invalid project id"),
    })
  })

