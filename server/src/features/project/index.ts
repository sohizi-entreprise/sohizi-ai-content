import { Elysia } from 'elysia'
import { z } from 'zod'
import * as projectService from './service'
import * as projectOptions from '@/constants/project-options'
import { createProjectSchema, updateProjectSchema} from "./schema";

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
  .post('', ({ body }) => {
    return projectService.startProject(body);
  }, {
    body: createProjectSchema,
  })
  .get('', ({ query }) => {
    return projectService.listProjects({
      cursor: query.cursor,
      limit: query.limit,
    });
  }, {
    query: z.object({
      cursor: z.string().optional(),
      limit: z.coerce.number().optional(),
    }),
  })
  .get('/:projectId', ({ params }) => {
    return projectService.getProject(params.projectId);
  }, {
    params: z.object({
      projectId: z.uuid("Invalid project id"),
    }),
  })
  .put('/:projectId', ({ body, params }) => {
    return projectService.updateProject(params.projectId, body);
  }, {
    params: z.object({
      projectId: z.uuid('Invalid project id'),
    }),
    body: updateProjectSchema,
  })
  .delete('/:projectId', ({ params, query }) => {
    return projectService.deleteProject({
      id: params.projectId,
      title: query.title,
    });
  }, {
    params: z.object({
      projectId: z.uuid('Invalid project id'),
    }),
    query: z.object({
      title: z.string().min(1, 'Title is required'),
    })
  })
  