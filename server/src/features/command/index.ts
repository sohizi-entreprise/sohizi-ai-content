import { Elysia } from 'elysia'
import { z } from 'zod'
import * as commandService from './service'
import { assertProjectAccess } from '@/lib/authorize'
import { authMiddleware } from '@/lib/auth-middleware'

const projectParams = z.object({
  projectId: z.uuid('Invalid project id'),
})

export const commandRoutes = new Elysia({ prefix: '/projects/:projectId/commands' })
  .guard({
    params: projectParams,
  })
  .use(authMiddleware)
  .resolve(async ({ params, user }) => {
    await assertProjectAccess(user.id, params.projectId)
    return {}
  })
  .get('/search', ({ params, query }) => {
    return commandService.searchCommands({
      projectId: params.projectId,
      name: query.name,
      limit: query.limit,
    })
  }, {
    query: z.object({
      name: z.string().trim().min(1, 'Search query is required'),
      limit: z.coerce.number().int().positive().optional(),
    }),
  })
