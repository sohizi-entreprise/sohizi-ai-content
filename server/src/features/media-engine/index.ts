import { Elysia } from 'elysia'
import * as mediaService from './service'
import {
    getUploadUrlSchema,
    uploadSuccessSchema,
} from './schema'
import { assertProjectAccess } from '@/lib/authorize'
import { authMiddleware } from '@/lib/auth-middleware'
import z from 'zod'

export {
    MediaError,
    MediaRateLimitError,
    MediaServiceUnavailableError,
    MediaProviderError,
    MediaValidationError,
    MediaConfigurationError,
    isMediaError,
} from './errors'

const bulkAssetIdsSchema = z.object({
    assetIds: z.array(z.uuid('Invalid asset id')).min(1, 'At least one asset is required').max(100, 'Too many assets selected'),
})

const bulkMoveAssetsSchema = bulkAssetIdsSchema.extend({
    folderId: z.uuid('Invalid folder id'),
})

export const mediaEngineRoutes = new Elysia({ prefix: '/media/:projectId' })
    .use(authMiddleware)
    .guard({
        params: z.object({ projectId: z.uuid('Invalid project id') }),
    })
    .post('/upload-success', async ({ body, user, params }) => {
        await assertProjectAccess(user.id, params.projectId)
        return mediaService.uploadSuccess(params.projectId, body);
    }, {
        body: uploadSuccessSchema,
    })
    .get('/upload-url', async ({ query, user, params }) => {
        await assertProjectAccess(user.id, params.projectId)
        return mediaService.getUploadUrl(params.projectId, query);
    }, {
        query: getUploadUrlSchema,
    })
    .get('/assets', async ({ params, user, query }) => {
        await assertProjectAccess(user.id, params.projectId)
        return mediaService.listAssets(params.projectId, query);
    }, {
        query: z.object({
            cursor: z.string().optional(),
            limit: z.number().optional(),
            type: z.enum(['image', 'video', 'audio', 'html']).optional(),
        }),
    })
    .get('/ai-assets', async ({ params, user, query }) => {
        await assertProjectAccess(user.id, params.projectId)
        return mediaService.listAiGeneratedAssets(params.projectId, query);
    }, {
        query: z.object({
            cursor: z.string().optional(),
            limit: z.number().optional(),
            type: z.enum(['image', 'video', 'audio', 'html']).optional(),
        }),
    })
    .get('/uploaded-assets', async ({ params, user, query }) => {
        await assertProjectAccess(user.id, params.projectId)
        return mediaService.listUploadedAssets(params.projectId, query);
    }, {
        query: z.object({
            cursor: z.string().optional(),
            limit: z.number().optional(),
            type: z.enum(['image', 'video', 'audio']).optional(),
        }),
    })
    .post('/assets', async ({ params, user, body }) => {
        const {organizationId} = await assertProjectAccess(user.id, params.projectId)
        return mediaService.generateAsset({
            projectId: params.projectId,
            userId: user.id,
            organizationId,
            ...body,
        });
    }, {
        body: mediaService.assetRequestSchema,
    })
    .post('/assets/bulk/move-to-folder', async ({ params, user, body }) => {
        await assertProjectAccess(user.id, params.projectId)
        return mediaService.attachAssetsToFileNodes(params.projectId, body.assetIds, body.folderId);
    }, {
        body: bulkMoveAssetsSchema,
    })
    .post('/assets/bulk/delete', async ({ params, user, body }) => {
        await assertProjectAccess(user.id, params.projectId)
        return mediaService.deleteAssets(params.projectId, body.assetIds);
    }, {
        body: bulkAssetIdsSchema,
    })
    .post('/assets/bulk/download-zip', async ({ params, user, body }) => {
        await assertProjectAccess(user.id, params.projectId)
        return mediaService.downloadAssetsZip(params.projectId, body.assetIds);
    }, {
        body: bulkAssetIdsSchema,
    })
    .guard({
        params: z.object({ 
            projectId: z.uuid('Invalid project id'),
            requestId: z.uuid('Invalid request id'),
        }),
    })
    .get('/requests/:requestId', async function* ({ params, user, set }) {
        await assertProjectAccess(user.id, params.projectId)
        set.headers['Content-Type'] = 'text/event-stream'
        set.headers['Cache-Control'] = 'no-cache'
        set.headers['Connection'] = 'keep-alive'
        yield* mediaService.getRequestStreams(params.requestId);
    })
    .delete('/requests/:requestId', async ({ params, user }) => {
        await assertProjectAccess(user.id, params.projectId)
        return mediaService.cancelGeneration(params.requestId);
    })
    .delete('/ai-requests/:requestId', async ({ params, user }) => {
        await assertProjectAccess(user.id, params.projectId)
        return mediaService.deleteGenerationRequest(params.projectId, params.requestId);
    })
    .guard({
        params: z.object({
            projectId: z.uuid('Invalid project id'),
            assetId: z.uuid('Invalid asset id'),
        }),
    })
    .get('/assets/:assetId/download-url', async ({ params, user }) => {
        await assertProjectAccess(user.id, params.projectId)
        return mediaService.getDownloadUrl(params.projectId, params.assetId);
    })
    .delete('/assets/:assetId', async ({ params, user }) => {
        await assertProjectAccess(user.id, params.projectId)
        return mediaService.deleteAsset(params.assetId);
    })
    .post('/assets/:assetId/move-to-folder', async ({ params, user, body }) => {
        await assertProjectAccess(user.id, params.projectId)
        return mediaService.attachAssetToFileNode(params.projectId, params.assetId, body.folderId);
    }, {
        body: z.object({
            folderId: z.uuid('Invalid folder id'),
        }),
    })
    .patch('/assets/:assetId/html-values', async ({ params, user, body }) => {
        await assertProjectAccess(user.id, params.projectId)
        return mediaService.updateHtmlAssetValues(params.projectId, params.assetId, body.values);
    }, {
        body: z.object({
            values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
        }),
    })