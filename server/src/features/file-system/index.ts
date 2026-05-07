import { Elysia } from 'elysia'
import { z } from 'zod'
import * as fileService from './service'
import { fileCreationRequestSchema, fileNodeInsertPositionSchema, updateTextFileContentRequestSchema } from './payload';

const projectParams = z.object({
    projectId: z.uuid('Invalid project id'),
})

const paramsSchema = z.object({
  projectId: z.uuid('Invalid project id'),
  id: z.uuid('Invalid file id'),
})

export const fileSystemRoutes = new Elysia({ prefix: '/projects/:projectId/files' })
  .guard({
        params: projectParams
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
    })
  }, {
    query: z.object({
      name: z.string().trim().min(1, 'Search query is required'),
      limit: z.coerce.number().int().positive().optional(),
    })
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