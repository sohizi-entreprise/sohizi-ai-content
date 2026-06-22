import { Elysia } from 'elysia'
import * as mediaService from './service'
import {
    getUploadUrlSchema,
    uploadSuccessSchema,
} from './schema'
import { assertProjectAccess } from '@/lib/authorize'
import { authMiddleware } from '@/lib/auth-middleware'

export {
    MediaError,
    MediaRateLimitError,
    MediaServiceUnavailableError,
    MediaProviderError,
    MediaValidationError,
    MediaConfigurationError,
    MediaGenerationFailedError,
    MediaTimeoutError,
    mediaErrorFromResponse,
    wrapAsMediaError,
    isMediaError,
    type WrapErrorOptions,
} from './errors'

export const mediaEngineRoutes = new Elysia({ prefix: '/media' })
    .use(authMiddleware)
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
