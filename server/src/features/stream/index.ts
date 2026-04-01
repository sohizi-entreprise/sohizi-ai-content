import { Elysia, sse } from 'elysia'
import { z } from 'zod'
import * as streamService from './service'
import { generationRequestSchema } from './schema'

const projectParams = z.object({
  id: z.uuid('Invalid project id'),
})

export const streamRoutes = new Elysia({ prefix: '/projects/:id/generations' })
  .guard({
    params: projectParams
  })
  .post('', async ({ params, body })=>{
    // Create a new generation request
    return streamService.handleGenerationRequest(params.id, body)
  },{
    body: generationRequestSchema,
  })
  .get('', async ({ params })=>{
    // List active generation requests for a project
    return streamService.listActiveGenerationRequests(params.id)
  },{
    
  })
  .delete('/:requestId', async ({ params })=>{
    // Cancel a generation request
    return streamService.cancelGenerationRequest(params.id, params.requestId)
  },{
    params: projectParams.extend({
      requestId: z.uuid('Invalid request id'),
    })
  })
  .get('/events', async function* ({ params, request }){
    // List active generation requests for a project
    for await (const event of streamService.sendSseEvents(params.id, request)) {
      yield sse(event)
    }
  },{
    params: projectParams,
  })
