import { Elysia } from 'elysia'
import { z } from 'zod'
import { assertProjectAccess } from '@/lib/authorize'
import { authMiddleware } from '@/lib/auth-middleware'
import {
  installSkillSchema,
  marketListQuerySchema,
  nameAvailableQuerySchema,
} from './schema'
import * as skillMarketService from './service'

const projectParams = z.object({
  projectId: z.uuid('Invalid project id'),
})

export const skillMarketRoutes = new Elysia()
  .use(authMiddleware)
  .group('/skills/market', (app) =>
    app
      .get('/', ({ query }) => skillMarketService.listMarketSkills(query), {
        query: marketListQuerySchema,
      })
      .get('/categories', () => skillMarketService.listMarketCategories())
      .get(
        '/:id',
        ({ params }) => skillMarketService.getMarketSkill(params.id),
        {
          params: z.object({
            id: z.uuid(),
          }),
        },
      ),
  )
  .group('/projects/:projectId/skills', (app) =>
    app
      .guard({
        params: projectParams,
      })
      .resolve(async ({ params, user }) => {
        await assertProjectAccess(user.id, params.projectId)
        return {}
      })
      .get(
        '/name-available',
        ({ params, query }) => {
          return skillMarketService.isSkillNameAvailable(
            params.projectId,
            query.name,
          )
        },
        {
          query: nameAvailableQuerySchema,
        },
      )
      .post(
        '/install',
        ({ params, body }) => {
          return skillMarketService.installSkill(params.projectId, body)
        },
        {
          body: installSkillSchema,
        },
      ),
  )

export { skillMarketService }
export * from './schema'
export { NameConflictError } from './errors'
