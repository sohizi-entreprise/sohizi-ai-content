import { Elysia, sse } from 'elysia'
import { z } from 'zod'
import * as chatService from './service'
import { CompletionRequestSchema } from './payload'

const projectParams = z.object({
  projectId: z.uuid('Invalid project id'),
})

const conversationParams = z.object({
  projectId: z.uuid('Invalid project id'),
  conversationId: z.uuid('Invalid conversation id'),
})

const paginationQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().optional(),
})

export const chatRoutes = new Elysia({ prefix: '/chats/:projectId' })
  .guard({
    params: projectParams,
  })
  .get('/conversations', ({ params, query }) => {
    return chatService.listConversations(params.projectId, query)
  }, {
    query: paginationQuery,
  })
  .get('/models', () => {
    return chatService.listModelsForLeadAgent()
  })
  .post('/conversations/messages', async function* ({ params, body }) {
    const generator = await chatService.handleChatCompletion(params.projectId, body)

    for await (const chunk of generator) {
      yield sse({
        event: chunk.type,
        data: JSON.stringify(chunk),
      })
    }
  }, {
    body: CompletionRequestSchema,
  })
  .guard({
    params: conversationParams,
  })
  .get('/conversations/:conversationId/messages', ({ params, query }) => {
    return chatService.listMessages(params.conversationId, query)
  }, {
    query: paginationQuery,
  })
  .delete('/conversations/:conversationId', ({ params }) => {
    return chatService.deleteConversation(params.conversationId)
  })