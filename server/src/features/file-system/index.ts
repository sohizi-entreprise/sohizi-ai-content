import { Elysia } from 'elysia'
import { z } from 'zod'
import * as fileService from './service'
import { fileCreationRequestSchema } from './payload';

// rename file
// reorder files
// move

const projectParams = z.object({
    projectId: z.uuid('Invalid project id'),
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
  .get('', ({params})=>{
    return fileService.listFileTreePerLevel(params.projectId, params.parentId)
  }, {
    params: projectParams.extend({
      parentId: z.uuid('Invalid parent id'),
    })
  })
  .get('/:id', ({params})=>{
    return fileService.getFileContent(params.projectId, params.id)
  }, {
    params: projectParams.extend({
      id: z.uuid('Invalid file id'),
    })
  })
  .delete('/:id', ({params})=>{
    return fileService.deleteFileNode(params.projectId, params.id)
  }, {
    params: projectParams.extend({
      id: z.uuid('Invalid file id'),
    })
  })
  .put('/:id/content', ({params, body})=>{
    return fileService.updateFileContent(params.projectId, params.id, body)
  }, {
    params: projectParams.extend({
      id: z.uuid('Invalid file id'),
    }),
    body: z.object({
      content: z.string(),
    })
  })