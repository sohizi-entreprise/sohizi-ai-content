import { Elysia, sse, t } from 'elysia'
import { z } from 'zod'
import { chatModel } from '@/entities/chat'
import * as chatService from './service'
import { redis, createBlockingRedisClient, ResumableStream } from '@/lib'
import { CreateMessageDTO, ReplyUserMessageDTO } from '@/entities/chat/model'

export const chatRoutes = new Elysia({ prefix: '/chats' })
  // ============================================================================
  // CONVERSATIONS
  // ============================================================================
  
  // Create a new conversation
  .post('/:projectId/conversations', ({ params }) => {
    return chatService.createConversation(params.projectId);
  }, {
    params: t.Object({
      projectId: t.String({ format: 'uuid' }),
    }),
    response: {
      200: chatModel.ConversationDTO,
    },
  })
  
  // Get conversations for a project
  .get('/:projectId/conversations', ({ params, query }) => {
    return chatService.getProjectConversations(params.projectId, query);
  }, {
    params: t.Object({
      projectId: t.String({ format: 'uuid' }),
    }),
    query: t.Object({
      cursor: t.Optional(t.String({ format: 'cursor' })),
      limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
    }),
    response: {
      // 200: chatModel.ConversationListDTO,
    },
  })

  
  // Delete a conversation
  .delete('/:projectId/conversations/:id', ({ params }) => {
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
  .get('/:projectId/conversations/:id/messages', ({ params, query }) => {
    return chatService.getConversationMessages(params.id, query);
  }, {
    params: t.Object({
      id: t.String({ format: 'uuid' }),
    }),
    query: t.Object({
      cursor: t.Optional(t.String({ format: 'cursor' })),
      limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
    }),
    response: {
      // 200: chatModel.MessageListDTO,
    },
  })

  .post('/:projectId/conversations/messages', async ({ body, params }) => {
    return chatService.replyUserMessage({
      prompt: body.prompt,
      context: body.context,
      conversationId: body.conversationId,
      selectedModel: body.selectedModel,
    }, params.projectId);
  }, {
    body: ReplyUserMessageDTO,
    params: t.Object({
      projectId: t.String({ format: 'uuid' }),
    }),
    response: {
      200: t.Object({
        success: t.Boolean(),
        streamId: t.String(),
        runId: t.String(),
        userMessageId: t.String(),
        conversation: chatModel.ConversationDTO,
      }),
    },
  })

  /**
   * GET stream - Connect and receive SSE for the conversation stream
   */
  .get('/:projectId/conversations/:id/stream', async function* ({ params, request }) {
    const { id: conversationId } = params

    const lastEventId = request.headers.get('Last-Event-ID') || undefined

    const stream = new ResumableStream(redis, conversationId)

    const exists = await stream.exists()
    if (!exists) {
      yield sse({ data: '' })
      return 
    }

    const blockingClient = createBlockingRedisClient()

    try {
      if (blockingClient.status === 'wait') {
        await blockingClient.connect()
      }

      // Yield once so the response is always text/event-stream (required by EventSource)
      yield sse({ data: '' })

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
    params: t.Object({
      projectId: t.String({ format: 'uuid' }),
      id: t.String({ format: 'uuid' }),
    }),
  })

  /**
   *  Cancel the edit stream
   */
  .delete('/:projectId/conversations/:id/stream', async ({ params }) => {
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
