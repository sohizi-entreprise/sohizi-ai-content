import { Elysia } from 'elysia'
import { z } from 'zod'
import * as projectService from './service'
import * as projectOptions from '@/constants/project-options'
import {
  createProjectSchema,
  createTemplateSchema,
  updateProjectSchema,
} from './schema'
import { assertProjectAccess, requireActiveOrganization } from '@/lib/authorize'
import { authMiddleware } from '@/lib/auth-middleware'

export const projectRoutes = new Elysia({ prefix: '/projects' })
  .get('/options', () => {
    return {
      formats: projectOptions.projectFormats,
      genres: projectOptions.projectGenres,
      duration: projectOptions.projectDuration,
      tones: projectOptions.projectTones,
      audiences: projectOptions.projectAudiences,
    }
  })
  .get(
    '/templates/published',
    ({ query }) => {
      return projectService.listPublishedTemplates({
        cursor: query.cursor,
        limit: query.limit,
      })
    },
    {
      query: z.object({
        cursor: z.string().optional(),
        limit: z.coerce.number().optional(),
      }),
    },
  )
  .use(authMiddleware)
  .post(
    '',
    ({ body, session }) => {
      const organizationId = requireActiveOrganization(session)
      return projectService.startProject(body, organizationId)
    },
    {
      body: createProjectSchema,
    },
  )
  .get(
    '',
    ({ query, session }) => {
      const organizationId = requireActiveOrganization(session)
      return projectService.listProjects(
        {
          cursor: query.cursor,
          limit: query.limit,
        },
        organizationId,
      )
    },
    {
      query: z.object({
        cursor: z.string().optional(),
        limit: z.coerce.number().optional(),
      }),
    },
  )
  .post(
    '/templates',
    ({ body, session }) => {
      const organizationId = requireActiveOrganization(session)
      return projectService.createTemplate(body, organizationId)
    },
    {
      body: createTemplateSchema,
    },
  )
  .get(
    '/templates',
    ({ query, session }) => {
      const organizationId = requireActiveOrganization(session)
      return projectService.listTemplates(
        {
          cursor: query.cursor,
          limit: query.limit,
        },
        organizationId,
      )
    },
    {
      query: z.object({
        cursor: z.string().optional(),
        limit: z.coerce.number().optional(),
      }),
    },
  )
  .get(
    '/:projectId',
    async ({ params, user }) => {
      await assertProjectAccess(user.id, params.projectId)
      return projectService.getProject(params.projectId)
    },
    {
      params: z.object({
        projectId: z.uuid('Invalid project id'),
      }),
    },
  )
  .put(
    '/:projectId',
    async ({ body, params, user }) => {
      await assertProjectAccess(user.id, params.projectId)
      return projectService.updateProject(params.projectId, body)
    },
    {
      params: z.object({
        projectId: z.uuid('Invalid project id'),
      }),
      body: updateProjectSchema,
    },
  )
  .delete(
    '/:projectId',
    async ({ params, query, user }) => {
      await assertProjectAccess(user.id, params.projectId)
      return projectService.deleteProject({
        id: params.projectId,
        title: query.title,
      })
    },
    {
      params: z.object({
        projectId: z.uuid('Invalid project id'),
      }),
      query: z.object({
        title: z.string().min(1, 'Title is required'),
      }),
    },
  )
