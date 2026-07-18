import { Elysia } from 'elysia'
import { z } from 'zod'
import { authMiddleware } from '@/lib/auth-middleware'
import * as modelsService from './service'

export const modelsRoutes = new Elysia({ prefix: '/models' })
  .use(authMiddleware)
  .get('/', async ({ query }) => {
    const categories = query.categories.split(',').map((value) => value.trim()).filter(Boolean)
    return modelsService.listLlmModels(categories)
  }, {
    query: z.object({
      categories: z.string().min(1),
    }),
  })
  .get('/:modelId/options', async ({ params }) => {
    return modelsService.listModelOptions(params.modelId)
  }, {
    params: z.object({
      modelId: z.string().min(1),
    }),
  })

export { modelsService }
export * from './schema'
