import { Elysia } from 'elysia'
import { z } from 'zod'
import * as videoEditorService from './service'
import {
  createCompositionSchema,
  updateCompositionSchema,
  addTrackSchema,
  updateTrackSchema,
  addClipSchema,
  updateClipSchema,
  clipFilterSchema,
  batchRequestSchema,
} from './schema'
import { assertProjectAccess } from '@/lib/authorize'
import { authMiddleware } from '@/lib/auth-middleware'

const projectParams = z.object({
  projectId: z.uuid('Invalid project id'),
})

const compositionParams = z.object({
  projectId: z.uuid('Invalid project id'),
  compositionId: z.uuid('Invalid composition id'),
})

const fileNodeParams = z.object({
  projectId: z.uuid('Invalid project id'),
  fileNodeId: z.uuid('Invalid file node id'),
})

const trackParams = z.object({
  projectId: z.uuid('Invalid project id'),
  trackId: z.uuid('Invalid track id'),
})

const clipParams = z.object({
  projectId: z.uuid('Invalid project id'),
  clipId: z.uuid('Invalid clip id'),
})

export const videoEditorRoutes = new Elysia({ prefix: '/video-editor/:projectId' })
  .use(authMiddleware)

  // ======================== COMPOSITIONS ========================

  .get('/file-nodes/:fileNodeId/composition', async ({ params, user }) => {
    await assertProjectAccess(user.id, params.projectId)
    return videoEditorService.loadComposition(params.fileNodeId, params.projectId)
  }, {
    params: fileNodeParams,
  })

  .post('/compositions', async ({ params, body, user }) => {
    await assertProjectAccess(user.id, params.projectId)
    return videoEditorService.createComposition(params.projectId, body)
  }, {
    params: projectParams,
    body: createCompositionSchema,
  })

  .patch('/compositions/:compositionId', async ({ params, body, user }) => {
    await assertProjectAccess(user.id, params.projectId)
    return videoEditorService.updateComposition(params.compositionId, params.projectId, body)
  }, {
    params: compositionParams,
    body: updateCompositionSchema,
  })

  // ======================== TRACKS ========================

  .get('/compositions/:compositionId/tracks', async ({ params, user }) => {
    await assertProjectAccess(user.id, params.projectId)
    return videoEditorService.listTracks(params.compositionId, params.projectId)
  }, {
    params: compositionParams,
  })

  .post('/compositions/:compositionId/tracks', async ({ params, body, user }) => {
    await assertProjectAccess(user.id, params.projectId)
    return videoEditorService.addTrack(params.compositionId, params.projectId, body)
  }, {
    params: compositionParams,
    body: addTrackSchema,
  })

  .patch('/tracks/:trackId', async ({ params, body, user }) => {
    await assertProjectAccess(user.id, params.projectId)
    return videoEditorService.updateTrack(params.trackId, params.projectId, body)
  }, {
    params: trackParams,
    body: updateTrackSchema,
  })

  .post('/tracks/:trackId/captions', async({params, user})=>{
    await assertProjectAccess(user.id, params.projectId)
    return videoEditorService.addCaption(params.trackId, params.projectId, user.id)
  }, {
    params: trackParams,
  })

  .delete('/tracks/:trackId', async ({ params, user }) => {
    await assertProjectAccess(user.id, params.projectId)
    return videoEditorService.removeTrack(params.trackId, params.projectId)
  }, {
    params: trackParams,
  })

  // ======================== CLIPS ========================

  .get('/compositions/:compositionId/clips', async ({ params, query, user }) => {
    await assertProjectAccess(user.id, params.projectId)
    return videoEditorService.listClips(params.compositionId, params.projectId, query)
  }, {
    params: compositionParams,
    query: clipFilterSchema,
  })

  .post('/compositions/:compositionId/clips', async ({ params, body, user }) => {
    await assertProjectAccess(user.id, params.projectId)
    return videoEditorService.addClip(params.compositionId, params.projectId, body)
  }, {
    params: compositionParams,
    body: addClipSchema,
  })

  .patch('/clips/:clipId', async ({ params, body, user }) => {
    await assertProjectAccess(user.id, params.projectId)
    return videoEditorService.updateClip(params.clipId, params.projectId, body)
  }, {
    params: clipParams,
    body: updateClipSchema,
  })

  .delete('/clips/:clipId', async ({ params, user }) => {
    await assertProjectAccess(user.id, params.projectId)
    return videoEditorService.removeClip(params.clipId, params.projectId)
  }, {
    params: clipParams,
  })

  // ======================== BATCH ========================

  .post('/compositions/:compositionId/batch', async ({ params, body, user }) => {
    await assertProjectAccess(user.id, params.projectId)
    return videoEditorService.batchEdit(params.compositionId, params.projectId, body.operations)
  }, {
    params: compositionParams,
    body: batchRequestSchema,
  })
