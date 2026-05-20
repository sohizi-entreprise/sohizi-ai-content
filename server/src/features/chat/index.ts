import { Elysia, sse } from 'elysia'
import { z } from 'zod'
import * as chatService from './service'
import { CompletionRequestSchema } from './payload'
import { assertProjectAccess, assertConversationOwner } from '@/lib/authorize'
import { authMiddleware } from '@/lib/auth-middleware'

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
  .use(authMiddleware)
  .get('/conversations', async ({ params, query, user }) => {
    await assertProjectAccess(user.id, params.projectId)
    return chatService.listConversations(params.projectId, user.id, query)
  }, {
    query: paginationQuery,
  })
  .get('/models', () => {
    return chatService.listModelsForLeadAgent()
  })
  .post('/conversations/messages', async function* ({ params, body, user }) {
    await assertProjectAccess(user.id, params.projectId)
    const generator = await chatService.handleChatCompletion(params.projectId, user.id, body)

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
  .get('/conversations/:conversationId/messages', async ({ params, query, user }) => {
    await assertConversationOwner(user.id, params.conversationId)
    return chatService.listMessages(params.conversationId, query)
  }, {
    query: paginationQuery,
  })
  .delete('/conversations/:conversationId', async ({ params, user }) => {
    await assertConversationOwner(user.id, params.conversationId)
    return chatService.deleteConversation(params.conversationId)
  })