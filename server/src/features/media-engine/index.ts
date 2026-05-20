import { Elysia } from 'elysia'
import * as mediaService from './service'
import {
    generateImageSchema,
    generateAudioSchema,
    generateVideoSchema,
    getRequestStatusesSchema,
    getUploadUrlSchema,
    projectIdParamSchema,
    uploadSuccessSchema,
} from './schema'
import { assertProjectAccess } from '@/lib/authorize'
import { authMiddleware } from '@/lib/auth-middleware'

export const mediaEngineRoutes = new Elysia({ prefix: '/media' })
    .use(authMiddleware)
    .post('/generate/image', async ({ body, user }) => {
        await assertProjectAccess(user.id, body.projectId)
        return mediaService.generateImage(body, user.id);
    }, {
        body: generateImageSchema,
    })
    .post('/generate/audio', async ({ body, user }) => {
        await assertProjectAccess(user.id, body.projectId)
        return mediaService.generateAudio(body, user.id);
    }, {
        body: generateAudioSchema,
    })
    .post('/generate/video', async ({ body, user }) => {
        await assertProjectAccess(user.id, body.projectId)
        return mediaService.generateVideo(body, user.id);
    }, {
        body: generateVideoSchema,
    })
    .post('/upload-success', async ({ body, user }) => {
        await assertProjectAccess(user.id, body.projectId)
        return mediaService.uploadSuccess(body);
    }, {
        body: uploadSuccessSchema,
    })
    .get('/upload-url', async ({ query, user }) => {
        await assertProjectAccess(user.id, query.projectId)
        return mediaService.getUploadUrl(query);
    }, {
        query: getUploadUrlSchema,
    })
    .get('/:projectId/requests', async ({ params, user }) => {
        await assertProjectAccess(user.id, params.projectId)
        return mediaService.getPendingRequests(params.projectId, user.id);
    }, {
        params: projectIdParamSchema,
    })
    .post('/:projectId/requests/status', async ({ params, body, user }) => {
        await assertProjectAccess(user.id, params.projectId)
        return mediaService.getRequestStatuses(params.projectId, body);
    }, {
        params: projectIdParamSchema,
        body: getRequestStatusesSchema,
    })
