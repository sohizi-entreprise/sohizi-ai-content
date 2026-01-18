import * as aiService from './service'
import { Elysia, sse, t } from 'elysia'
import { z } from 'zod'


export const aiRoutes = new Elysia({ prefix: '/ai' })
  .post('/brief/project/:id', async function*({ params }){
    const streams = await aiService.generateBrief(params.id)
    yield sse({
      event: 'start',
      data: null,
    })
    for await (const chunk of streams) {
      // The AI SDK's partialOutputStream returns chunks in the AI SDK data stream format
      // These are already strings in the correct format (e.g., '0:"data"', '1:"data"')
      // Send them directly as SSE data
      const data = typeof chunk === 'string' ? chunk : JSON.stringify(chunk)
      yield sse({
        event: 'chunk_delta',
        data: data,
      })
    }
    yield sse({
      event: 'end',
      data: null,
    })
  }, {
    params: z.object({
      id: z.uuid("Invalid project id"),
    })
  })

  .post('/correct/script', async function*({ body }){
    const streams = await aiService.correctScript(body)
    yield sse({
      event: 'start',
      data: null,
    })
    for await (const chunk of streams) {
      const data = typeof chunk === 'string' ? chunk : JSON.stringify(chunk)
      yield sse({
        event: 'chunk_delta',
        data: data,
      })
    }
    yield sse({
      event: 'end',
      data: null,
    })
  }, {
    body: t.Object({
      brief: t.String(),
      feedback: t.String(),
      partsToEdit: t.String(),
    })
  })