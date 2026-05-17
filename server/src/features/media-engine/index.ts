import { Elysia } from 'elysia'
import * as mediaService from './service'
import {
    generateImageSchema,
    generateAudioSchema,
    generateVideoSchema,
    getUploadUrlSchema,
    projectIdParamSchema,
    uploadSuccessSchema,
} from './schema'

export const mediaEngineRoutes = new Elysia({ prefix: '/media' })
    .post('/generate/image', ({ body }) => {
        return mediaService.generateImage(body);
    }, {
        body: generateImageSchema,
    })
    .post('/generate/audio', ({ body }) => {
        return mediaService.generateAudio(body);
    }, {
        body: generateAudioSchema,
    })
    .post('/generate/video', ({ body }) => {
        return mediaService.generateVideo(body);
    }, {
        body: generateVideoSchema,
    })
    .post('/upload-success', ({ body }) => {
        return mediaService.uploadSuccess(body);
    }, {
        body: uploadSuccessSchema,
    })
    .get('/upload-url', ({ query }) => {
        return mediaService.getUploadUrl(query);
    }, {
        query: getUploadUrlSchema,
    })
    .get('/:projectId/requests', ({ params }) => {
        return mediaService.getPendingRequests(params.projectId);
    }, {
        params: projectIdParamSchema,
    })
