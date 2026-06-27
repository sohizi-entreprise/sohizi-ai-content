import { Elysia } from 'elysia'
import { z } from 'zod'
import * as chatService from './service'
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

const runParams = z.object({
  projectId: z.uuid('Invalid project id'),
  conversationId: z.uuid('Invalid conversation id'),
  runId: z.uuid('Invalid run id'),
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
  .post('/conversations', async ({ params, body, user }) => {
    await assertProjectAccess(user.id, params.projectId)
    return chatService.chatCompletion(user.id, params.projectId, body)
  }, {
    body: chatService.completionSchema,
    params: projectParams,
  })
  .get('/models', async ({ query }) => {
    const categories = query.categories.split(',')
    return chatService.listLlmModels(categories)
  }, {
    query: z.object({
      categories: z.string(),
    }),
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
  .get('/conversations/:conversationId/runs', async ({ params, query, user }) => {
    await assertConversationOwner(user.id, params.conversationId)
    return chatService.listConversationAgentRuns(params.conversationId, query)
  }, {
    query: paginationQuery,
  })
  .delete('/conversations/:conversationId', async ({ params, user }) => {
    await assertConversationOwner(user.id, params.conversationId)
    return chatService.deleteConversation(params.conversationId)
  })
  .guard({
    params: runParams,
  })
  .delete('/conversations/:conversationId/runs/:runId', async ({ params, user }) => {
    await assertConversationOwner(user.id, params.conversationId)
    return chatService.cancelRun(params.runId)
  }, {
    params: runParams,
  })

  .get('/conversations/:conversationId/runs/:runId', async function* ({ params, user, set }) {
    await assertConversationOwner(user.id, params.conversationId)

    set.headers['Content-Type'] = 'text/event-stream'
    set.headers['Cache-Control'] = 'no-cache'
    set.headers['Connection'] = 'keep-alive'

    yield* chatService.getStreams(params.runId)
  }, {
    params: runParams,
  })