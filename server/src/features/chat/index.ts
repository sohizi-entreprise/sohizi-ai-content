import { Elysia, sse, t } from 'elysia'
import { z } from 'zod'
import { chatModel } from '@/entities/chat'
import * as chatService from './service'
import { redis, createBlockingRedisClient, ResumableStream } from '@/lib'

export const chatRoutes = new Elysia({ prefix: '/chat' })
  // ============================================================================
  // CONVERSATIONS
  // ============================================================================
  
  // Create a new conversation
  .post('/conversations', ({ body }) => {
    return chatService.createConversation(body);
  }, {
    body: chatModel.CreateConversationDTO,
    response: {
      200: chatModel.ConversationDTO,
    },
  })
  
  // Get conversations for a project
  .get('/conversations/project/:projectId', ({ params, query }) => {
    return chatService.getProjectConversations(params.projectId, query.editorType);
  }, {
    params: t.Object({
      projectId: t.String({ format: 'uuid' }),
    }),
    query: t.Object({
      editorType: t.Optional(t.String()),
    }),
    response: {
      200: chatModel.ConversationListDTO,
    },
  })
  
  // Get a specific conversation
  .get('/conversations/:id', ({ params }) => {
    return chatService.getConversation(params.id);
  }, {
    params: t.Object({
      id: t.String({ format: 'uuid' }),
    }),
    response: {
      200: chatModel.ConversationDTO,
    },
  })
  
  // Update a conversation
  .put('/conversations/:id', ({ params, body }) => {
    return chatService.updateConversation(params.id, body);
  }, {
    params: t.Object({
      id: t.String({ format: 'uuid' }),
    }),
    body: chatModel.UpdateConversationDTO,
    response: {
      200: chatModel.ConversationDTO,
    },
  })
  
  // Delete a conversation
  .delete('/conversations/:id', ({ params }) => {
    return chatService.deleteConversation(params.id);
  }, {
    params: t.Object({
      id: t.String({ format: 'uuid' }),
    }),
    response: {
      200: t.Object({ confirmed: t.Boolean() }),
    },
  })
  
  // ============================================================================
  // MESSAGES
  // ============================================================================
  
  // Get messages for a conversation
  .get('/conversations/:id/messages', ({ params }) => {
    return chatService.getConversationMessages(params.id);
  }, {
    params: t.Object({
      id: t.String({ format: 'uuid' }),
    }),
    response: {
      200: chatModel.MessageListDTO,
    },
  })

  .post('/conversations/:id/messages', async ({ body, params }) => {
    return chatService.editContent({
      projectId: body.projectId,
      conversationId: params.id,
      component: body.component,
      prompt: body.prompt,
      context: body.context || {},
    })
  }, {
    body: t.Object({
      projectId: t.String({ format: 'uuid' }),
      component: t.Union([
        t.Literal('script'),
        t.Literal('synopsis'),
        t.Literal('characters'),
        t.Literal('world'),
      ]),
      prompt: t.String(),
      context: t.Optional(t.Object({
        blocks: t.Optional(t.Array(t.String())),
        selections: t.Optional(t.Array(t.String())),
      })),
    }),
    params: t.Object({
      id: t.String({ format: 'uuid' }),
    }),
    response: {
      200: t.Object({
        ok: t.Boolean(),
        streamKey: t.String(),
      }),
    },
  })

  // ============================================================================
  // EDIT STREAM (SSE)
  // ============================================================================

  /**
   * GET /chat/conversations/:id/stream - SSE endpoint for edit stream
   */
  .get('/conversations/:id/stream', async function* ({ params, request }) {
    const { id: conversationId } = params

    // Get Last-Event-ID from headers (for resumption)
    const lastEventId = request.headers.get('Last-Event-ID') || undefined

    // The streamKey is the conversationId
    const stream = new ResumableStream(redis, conversationId)
    
    // Check if stream exists
    const exists = await stream.exists()
    if (!exists) {
      yield sse({
        event: 'error',
        id: '0',
        data: JSON.stringify({ message: 'Stream not found or expired' }),
      })
      return
    }

    // Create a blocking client for this subscription
    const blockingClient = createBlockingRedisClient()
    
    try {
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
      await blockingClient.quit().catch(() => {})
    }
  }, {
    params: z.object({
      id: z.uuid('Invalid conversation id'),
    }),
  })

  /**
   * DELETE /chat/conversations/:id/stream - Cancel the edit stream
   */
  .delete('/conversations/:id/stream', async ({ params }) => {
    const { id: conversationId } = params

    const stream = new ResumableStream(redis, conversationId)
    
    // Set cancel flag
    await stream.cancel()

    return { ok: true }
  }, {
    params: z.object({
      id: z.uuid('Invalid conversation id'),
    }),
    response: {
      200: t.Object({
        ok: t.Boolean(),
      }),
    },
  })
