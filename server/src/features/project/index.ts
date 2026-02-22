import { Elysia, t } from 'elysia'
import { z } from 'zod'
import { projectModel } from '@/entities/project'
import * as projectService from './service'
import * as projectOptions from '@/constants/project-options'

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
    body: projectModel.CreateProjectDTO,
    response: {
      200: t.Object({ project: projectModel.ProjectResponseDTO }),
    },
  })
  .get('', () => {
    return projectService.listProjects();
  }, {
    response: {
      200: t.Array(projectModel.ListProjectsResponseDTO),
    },
  })
  .get('/:id', ({ params }) => {
    return projectService.getProject(params.id);
  }, {
    params: z.object({
      id: z.uuid("Invalid project id"),
    }),
    response: {
      200: projectModel.ProjectResponseDTO,
    },
  })
  .put('/:id', ({ body, params }) => {
    return projectService.updateProject(params.id, body);
  }, {
    params: t.Object({
      id: t.String(),
    }),
    body: projectModel.UpdateProjectDTO,
    response: {
      200: projectModel.ProjectResponseDTO,
    },
  })
  .delete('/:id', ({ params }) => {
    return projectService.deleteProject(params.id);
  }, {
    params: t.Object({
      id: t.String(),
    }),
    response: {
      200: t.Object({ confirmed: t.Boolean() }),
    },
  })