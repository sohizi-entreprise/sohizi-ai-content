import { Elysia, sse, t } from 'elysia'
import { z } from 'zod'
import { redis, createBlockingRedisClient, ResumableStream } from '@/lib'
import * as aiService from '@/features/ai/service'


export const streamRoutes = new Elysia({ prefix: '/stream' })
  /**
   * POST /stream/start - Initialize a stream and fire the LLM job
   */
  .post('/start', async ({ body }) => {
    const { projectId, type, prompt } = body
    return aiService.generateScriptComponents(projectId, type, prompt)

  }, {
    body: t.Object({
      projectId: t.String({ format: 'uuid' }),
      type: t.UnionEnum(aiService.supportedScriptComponentTypes),
      prompt: t.Optional(t.String()),
    }),
    response: {
      200: t.Object({
        ok: t.Boolean(),
        projectId: t.String(),
      }),
    },
  })

  /**
   * GET /stream/:projectId - SSE endpoint for EventSource subscription
   */
  .get('/:projectId', async function* ({ params, request }) {
    const { projectId } = params

    // Get Last-Event-ID from headers (for resumption)
    const lastEventId = request.headers.get('Last-Event-ID') || undefined

    const stream = new ResumableStream(redis, projectId)
    
    // Check if stream exists
    const exists = await stream.exists()
    if (!exists) {
      // Stream doesn't exist yet or was cleaned up
      // Return a single error event
      yield sse({
        event: 'empty',
        id: '0',
        data: JSON.stringify({ message: 'Stream not found or expired' }),
      })
      return
    }

    // Create a blocking client for this subscription
    const blockingClient = createBlockingRedisClient()
    
    try {
      // Only connect if not already connected (ioredis auto-connects by default)
      if (blockingClient.status === 'wait') {
        await blockingClient.connect()
      }
      
      for await (const entry of stream.subscribe(blockingClient, lastEventId)) {
        yield sse({
          event: entry.event.type,
          id: entry.id,
          data: JSON.stringify(entry.event.data),
        })
      }
    } finally {
      // Clean up the blocking client
      await blockingClient.quit().catch(() => {})
    }
  }, {
    params: z.object({
      projectId: z.uuid('Invalid project id'),
    }),
  })

  /**
   * DELETE /stream/:projectId - Cancel the stream
   */
  .delete('/:projectId', async ({ params }) => {
    const { projectId } = params

    const stream = new ResumableStream(redis, projectId)
    
    // Set cancel flag
    await stream.cancel()

    // Update generation request status
    // Note: We'd need to find the request by projectId, but for simplicity
    // we just set the cancel flag and let the producer handle it

    return { ok: true }
  }, {
    params: z.object({
      projectId: z.uuid('Invalid project id'),
    }),
    response: {
      200: t.Object({
        ok: t.Boolean(),
      }),
    },
  })
