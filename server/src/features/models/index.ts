import { Elysia } from 'elysia'
import { z } from 'zod'
import { authMiddleware } from '@/lib/auth-middleware'
import { mediaConstants } from '@/constants'
import * as modelsService from './service'

const categoriesQuerySchema = z
  .union([z.string().min(1), z.array(z.string().min(1)).min(1)])
  .transform((value) =>
    (Array.isArray(value) ? value : value.split(','))
      .flatMap((item) => item.split(','))
      .map((item) => item.trim())
      .filter(Boolean),
  )

export const modelsRoutes = new Elysia({ prefix: '/models' })
  .use(authMiddleware)
  .get('/', async ({ query }) => {
    return modelsService.listLlmModels(query.categories)
  }, {
    query: z.object({
      categories: categoriesQuerySchema,
    }),
  })
  .get('/voices', () => mediaConstants.googleVoiceDescriptions)
  .get('/:modelId/parameters', async ({ params }) => {
    return modelsService.listModelParameters(params.modelId)
  }, {
    params: z.object({
      modelId: z.string().min(1),
    }),
  })

export { modelsService }
export * from './schema'
