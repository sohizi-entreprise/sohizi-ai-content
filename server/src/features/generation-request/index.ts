import { Elysia, t } from 'elysia'
import * as service from './service'
import { chatCompletionRequestSchema, mediaGenerationRequestSchema } from './schema'
import { assertProjectAccess } from '@/lib/authorize'
import { authMiddleware } from '@/lib/auth-middleware'

export const generationRequestRoutes = new Elysia({ prefix: '/generations' })
    .use(authMiddleware)
    .post('/chat-completion/:projectId', async ({ params, body, user }) => {
        await assertProjectAccess(user.id, params.projectId)
        return service.handleChatCompletionRequest(body, user.id, params.projectId)
    }, {
        body: chatCompletionRequestSchema,
        params: t.Object({ projectId: t.String({ format: 'uuid' }) }),
    })
    .post('/media/:projectId', async ({ params, body, user }) => {
        await assertProjectAccess(user.id, params.projectId)
        return service.handleMediaGenerationRequest(body, user.id, params.projectId)
    }, {
        body: mediaGenerationRequestSchema,
        params: t.Object({ projectId: t.String({ format: 'uuid' }) }),
    })
    .post('/cancel/:projectId/:requestId', async ({ params, user }) => {
        await assertProjectAccess(user.id, params.projectId)
        return service.cancelRequest(params.projectId, user.id, params.requestId)
    }, {
        params: t.Object({ projectId: t.String({ format: 'uuid' }), requestId: t.String({ format: 'uuid' }) }),
    })
    .get('/pending/:projectId', async ({ params, user }) => {
        await assertProjectAccess(user.id, params.projectId)
        return service.listPendingRequests(params.projectId, user.id)
    }, {
        params: t.Object({ projectId: t.String({ format: 'uuid' }) }),
    })
    .post('/statuses/:projectId', async ({ params, body, user }) => {
        await assertProjectAccess(user.id, params.projectId)
        return service.getRequestStatuses(params.projectId, body)
    }, {
        body: t.Object({ requestIds: t.Array(t.String()) }),
        params: t.Object({ projectId: t.String({ format: 'uuid' }) }),
    })
