import { Elysia } from 'elysia'
import { z } from 'zod'
import { adminMiddleware } from '@/lib/admin-middleware'
import * as adminService from './service'
import {
  createCategorySchema,
  createModelSchema,
  createModelVendorBindingSchema,
  createParameterOptionSchema,
  createParameterSchema,
  createVendorSchema,
  replaceCategoriesSchema,
  replaceModelParametersSchema,
  updateModelSchema,
  updateModelVendorBindingSchema,
  updateParameterOptionSchema,
  updateParameterSchema,
  updateVendorSchema,
  upsertVendorOptionMapSchema,
  upsertVendorParameterMapSchema,
} from '../models/schema'
import { createCommandSchema, updateCommandSchema } from '../command/schema'
import {
  createContentCategorySchema,
  updateContentCategorySchema,
} from '../content-categories/schema'
import {
  createSkillSchema,
  replaceSkillCategoriesSchema,
  updateSkillSchema,
} from '../skills/schema'

export const adminRoutes = new Elysia({ prefix: '/admin' })
  .use(adminMiddleware)
  .get('/categories', () => adminService.listCategories())
  .post('/categories', ({ body }) => adminService.createCategory(body), {
    body: createCategorySchema,
  })
  .delete(
    '/categories/:id',
    ({ params }) => adminService.deleteCategory(params.id),
    {
      params: z.object({ id: z.uuid() }),
    },
  )
  .get('/models', () => adminService.listModels())
  .post('/models', ({ body }) => adminService.createModel(body), {
    body: createModelSchema,
  })
  .get('/models/:id', ({ params }) => adminService.getModel(params.id), {
    params: z.object({ id: z.string().min(1) }),
  })
  .patch(
    '/models/:id',
    ({ params, body }) => adminService.updateModel(params.id, body),
    {
      params: z.object({ id: z.string().min(1) }),
      body: updateModelSchema,
    },
  )
  .delete('/models/:id', ({ params }) => adminService.deleteModel(params.id), {
    params: z.object({ id: z.string().min(1) }),
  })
  .put(
    '/models/:id/categories',
    ({ params, body }) => adminService.replaceModelCategories(params.id, body),
    {
      params: z.object({ id: z.string().min(1) }),
      body: replaceCategoriesSchema,
    },
  )
  .get(
    '/models/:id/parameters',
    ({ params }) => adminService.listModelParameters(params.id),
    {
      params: z.object({ id: z.string().min(1) }),
    },
  )
  .put(
    '/models/:id/parameters',
    ({ params, body }) => adminService.replaceModelParameters(params.id, body),
    {
      params: z.object({ id: z.string().min(1) }),
      body: replaceModelParametersSchema,
    },
  )
  .post(
    '/models/:id/vendors',
    ({ params, body }) =>
      adminService.createModelVendorBinding(params.id, body),
    {
      params: z.object({ id: z.string().min(1) }),
      body: createModelVendorBindingSchema,
    },
  )
  .patch(
    '/models/:id/vendors/:vendorId',
    ({ params, body }) =>
      adminService.updateModelVendorBinding(params.id, params.vendorId, body),
    {
      params: z.object({ id: z.string().min(1), vendorId: z.uuid() }),
      body: updateModelVendorBindingSchema,
    },
  )
  .delete(
    '/models/:id/vendors/:vendorId',
    ({ params }) =>
      adminService.deleteModelVendorBinding(params.id, params.vendorId),
    {
      params: z.object({ id: z.string().min(1), vendorId: z.uuid() }),
    },
  )
  .get('/vendors', () => adminService.listVendors())
  .get('/media-vendor-slugs', () => adminService.listMediaVendorSlugs())
  .post('/vendors', ({ body }) => adminService.createVendor(body), {
    body: createVendorSchema,
  })
  .patch(
    '/vendors/:id',
    ({ params, body }) => adminService.updateVendor(params.id, body),
    {
      params: z.object({ id: z.uuid() }),
      body: updateVendorSchema,
    },
  )
  .delete(
    '/vendors/:id',
    ({ params }) => adminService.deleteVendor(params.id),
    {
      params: z.object({ id: z.uuid() }),
    },
  )
  .get('/parameters', () => adminService.listParameters())
  .post('/parameters', ({ body }) => adminService.createParameter(body), {
    body: createParameterSchema,
  })
  .get(
    '/parameters/:id',
    ({ params }) => adminService.getParameter(params.id),
    {
      params: z.object({ id: z.uuid() }),
    },
  )
  .patch(
    '/parameters/:id',
    ({ params, body }) => adminService.updateParameter(params.id, body),
    {
      params: z.object({ id: z.uuid() }),
      body: updateParameterSchema,
    },
  )
  .delete(
    '/parameters/:id',
    ({ params }) => adminService.deleteParameter(params.id),
    {
      params: z.object({ id: z.uuid() }),
    },
  )
  .post(
    '/parameters/:id/options',
    ({ params, body }) => adminService.createParameterOption(params.id, body),
    {
      params: z.object({ id: z.uuid() }),
      body: createParameterOptionSchema,
    },
  )
  .patch(
    '/parameters/:id/options/:optionId',
    ({ params, body }) =>
      adminService.updateParameterOption(params.id, params.optionId, body),
    {
      params: z.object({ id: z.uuid(), optionId: z.uuid() }),
      body: updateParameterOptionSchema,
    },
  )
  .delete(
    '/parameters/:id/options/:optionId',
    ({ params }) =>
      adminService.deleteParameterOption(params.id, params.optionId),
    {
      params: z.object({ id: z.uuid(), optionId: z.uuid() }),
    },
  )
  .put(
    '/parameters/:id/options/:optionId/vendors/:vendorId',
    ({ params, body }) =>
      adminService.upsertVendorOptionMapping(
        params.id,
        params.optionId,
        params.vendorId,
        body,
      ),
    {
      params: z.object({
        id: z.uuid(),
        optionId: z.uuid(),
        vendorId: z.uuid(),
      }),
      body: upsertVendorOptionMapSchema,
    },
  )
  .delete(
    '/parameters/:id/options/:optionId/vendors/:vendorId',
    ({ params }) =>
      adminService.deleteVendorOptionMapping(
        params.id,
        params.optionId,
        params.vendorId,
      ),
    {
      params: z.object({
        id: z.uuid(),
        optionId: z.uuid(),
        vendorId: z.uuid(),
      }),
    },
  )
  .put(
    '/parameters/:id/vendors/:vendorId',
    ({ params, body }) =>
      adminService.upsertVendorParameterMapping(
        params.id,
        params.vendorId,
        body,
      ),
    {
      params: z.object({ id: z.uuid(), vendorId: z.uuid() }),
      body: upsertVendorParameterMapSchema,
    },
  )
  .delete(
    '/parameters/:id/vendors/:vendorId',
    ({ params }) =>
      adminService.deleteVendorParameterMapping(params.id, params.vendorId),
    {
      params: z.object({ id: z.uuid(), vendorId: z.uuid() }),
    },
  )
  .get('/commands', () => adminService.listCommands())
  .post('/commands', ({ body }) => adminService.createCommand(body), {
    body: createCommandSchema,
  })
  .get('/commands/:id', ({ params }) => adminService.getCommand(params.id), {
    params: z.object({ id: z.uuid() }),
  })
  .patch(
    '/commands/:id',
    ({ params, body }) => adminService.updateCommand(params.id, body),
    {
      params: z.object({ id: z.uuid() }),
      body: updateCommandSchema,
    },
  )
  .delete(
    '/commands/:id',
    ({ params }) => adminService.deleteCommand(params.id),
    {
      params: z.object({ id: z.uuid() }),
    },
  )
  .get('/content-categories', () => adminService.listContentCategories())
  .post(
    '/content-categories',
    ({ body }) => adminService.createContentCategory(body),
    {
      body: createContentCategorySchema,
    },
  )
  .get(
    '/content-categories/:id',
    ({ params }) => adminService.getContentCategory(params.id),
    {
      params: z.object({ id: z.uuid() }),
    },
  )
  .patch(
    '/content-categories/:id',
    ({ params, body }) => adminService.updateContentCategory(params.id, body),
    {
      params: z.object({ id: z.uuid() }),
      body: updateContentCategorySchema,
    },
  )
  .delete(
    '/content-categories/:id',
    ({ params }) => adminService.deleteContentCategory(params.id),
    {
      params: z.object({ id: z.uuid() }),
    },
  )
  .get('/skills', () => adminService.listSkills())
  .post('/skills', ({ body }) => adminService.createSkill(body), {
    body: createSkillSchema,
  })
  .get('/skills/:id', ({ params }) => adminService.getSkill(params.id), {
    params: z.object({ id: z.uuid() }),
  })
  .patch(
    '/skills/:id',
    ({ params, body }) => adminService.updateSkill(params.id, body),
    {
      params: z.object({ id: z.uuid() }),
      body: updateSkillSchema,
    },
  )
  .delete('/skills/:id', ({ params }) => adminService.deleteSkill(params.id), {
    params: z.object({ id: z.uuid() }),
  })
  .put(
    '/skills/:id/categories',
    ({ params, body }) => adminService.replaceSkillCategories(params.id, body),
    {
      params: z.object({ id: z.uuid() }),
      body: replaceSkillCategoriesSchema,
    },
  )
