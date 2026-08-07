import { Elysia } from 'elysia'
import { z } from 'zod'
import * as fileService from './service'
import { fileCreationRequestSchema, fileNodeInsertPositionSchema, updateSkillRequestSchema, updateTextFileContentRequestSchema } from './payload';
import { assertProjectAccess } from '@/lib/authorize'
import { authMiddleware } from '@/lib/auth-middleware'
import { fileFormat } from './constants';

const projectParams = z.object({
    projectId: z.uuid('Invalid project id'),
})

const paramsSchema = z.object({
  projectId: z.uuid('Invalid project id'),
  id: z.uuid('Invalid file id'),
})

export const fileSystemRoutes = new Elysia({ prefix: '/projects/:projectId/files' })
  .guard({
        params: projectParams,
    })
  .use(authMiddleware)
  .resolve(async ({ params, user }) => {
    await assertProjectAccess(user.id, params.projectId)
    return {}
  })
  .post('', ({body}) => {
    return fileService.createFileNode(body)
  }, {
    body: fileCreationRequestSchema
  })
  .get('', ({params, query})=>{
    return fileService.listFileTreePerLevel(params.projectId, query.parentId)
  }, {
    params: projectParams,
    query: z.object({
      parentId: z.uuid('Invalid parent id'),
    })
  })
  .get('/search', ({params, query}) => {
    return fileService.searchFilesByName({
      projectId: params.projectId,
      name: query.name,
      limit: query.limit,
      directory: query.directory,
      format: query.format,
    })
  }, {
    query: z.object({
      name: z.string().trim().min(1, 'Search query is required'),
      limit: z.coerce.number().int().positive().optional(),
      directory: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
      format: z.enum([
        fileFormat.MARKDOWN,
        fileFormat.JSON,
        fileFormat.IMAGE,
        fileFormat.VIDEO,
        fileFormat.AUDIO,
        fileFormat.DOCUMENT,
        fileFormat.VIDEO_EDITOR,
        fileFormat.AI_GENERATED,
        fileFormat.SKILL,
      ]).optional(),
    })
  })
  .get('/by-format', ({params, query}) => {
    return fileService.listFilesByFormat({
      projectId: params.projectId,
      format: query.format,
      limit: query.limit,
    })
  }, {
    query: z.object({
      format: z.enum([
        fileFormat.MARKDOWN,
        fileFormat.JSON,
        fileFormat.IMAGE,
        fileFormat.VIDEO,
        fileFormat.AUDIO,
        fileFormat.DOCUMENT,
        fileFormat.VIDEO_EDITOR,
        fileFormat.AI_GENERATED,
        fileFormat.SKILL,
      ]),
      limit: z.coerce.number().int().positive().optional(),
    })
  })
  .get('/pending-operations', ({params})=>{
    return fileService.listPendingFileOperations(params.projectId)
  })
  .guard({
    params: paramsSchema
  })
  .get('/:id', ({params})=>{
    return fileService.getFileContent(params.projectId, params.id)
  })
  .delete('/:id', ({params})=>{
    return fileService.deleteFileNode(params.projectId, params.id)
  })
  .put('/:id/content', ({params, body})=>{
    return fileService.updateFileContent(params.projectId, params.id, body)
  }, {
    body: updateTextFileContentRequestSchema
  })
  .put('/:id/skill', ({params, body})=>{
    return fileService.updateSkill(params.projectId, params.id, body)
  }, {
    body: updateSkillRequestSchema
  })
  .put('/:id/rename', ({params, body})=>{
    return fileService.updateFileNode(params.projectId, { id: params.id, name: body.name })
  }, {
    body: z.object({
      name: z.string().max(50, 'Name must be less than 50 characters'),
    })
  })
  .put('/:id/move', ({params, body})=>{
    return fileService.updateFileNode(params.projectId, {
      id: params.id,
      parentId: body.parentId,
      anchorId: body.anchorId,
      position: body.position,
    })
  }, {
    body: z.object({
      parentId: z.string().nullable().optional(),
      anchorId: z.string().nullable().optional(),
      position: fileNodeInsertPositionSchema,
    })
  })
  .get('/:id/pending-operations', ({params})=>{
    return fileService.getPendingFileOperation(params.projectId, params.id)
  }, {
    params: paramsSchema
  })
  .delete('/:id/pending-operations', ({params})=>{
    return fileService.deletePendingFileOperation(params.projectId, params.id)
  }, {
    params: paramsSchema
  })