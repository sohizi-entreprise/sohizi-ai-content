import { Elysia, t } from 'elysia'
import { z } from 'zod'
import { projectModel } from '@/entities/project'
import * as projectService from './service'
import * as projectOptions from '@/constants/project-options'
import { EntityObjectDTO, NarrativeArcItemDTO } from '@/entities/project/model'
import { generateScriptComponents, regenerateEntity, supportedScriptComponentTypes } from '@/features/ai/service'
import { ResumableStream, redis } from '@/lib'
import { entityTypes } from '@/constants/project'

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
  .put('/:id/narrative-arcs', ({ body, params }) => {
    return projectService.selectNarrativeArc(params.id, body);
  }, {
    params: t.Object({
      id: t.String(),
    }),
    body: t.Array(NarrativeArcItemDTO),
    response: {
      200: t.Object({ ok: t.Boolean() }),
    },
  })
  .post('/:id/generate/:componentType', async ({ params }) => {
    const result = await generateScriptComponents(params.id, params.componentType);
    return { ok: result.ok, streamId: result.projectId };
  }, {
    params: t.Object({
      id: t.String(),
      componentType: t.Union(supportedScriptComponentTypes.map(type => t.Literal(type))),
    }),
    response: {
      200: t.Object({ ok: t.Boolean(), streamId: t.String() }),
    },
  })
  .delete('/:id/generate/stream', async ({ params }) => {
    const stream = new ResumableStream(redis, params.id);
    await stream.cancel();
    return { ok: true };
  }, {
    params: z.object({
      id: z.uuid('Invalid stream id'),
    }),
    response: {
      200: t.Object({ ok: t.Boolean() }),
    },
  })
  .get('/:id/entities', ({ params, query }) => {
    return projectService.listAllEntities(params.id, query.cursor, query.limit, query.entityType);
  }, {
    params: z.object({
      id: z.uuid('Invalid project id'),
    }),
    query: t.Object({
      cursor: t.Optional(t.String({ format: 'cursor' })),
      limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
      entityType: t.Optional(t.UnionEnum(entityTypes, { default: undefined })),
    }),
    response: {
      // 200: t.Array(EntityObjectDTO),
    },
  })
  .get('/:id/entities/:entityId', ({ params }) => {
    return projectService.getEntity(params.id, params.entityId);
  }, {
    params: z.object({
      id: z.uuid('Invalid project id'),
      entityId: z.uuid('Invalid entity id'),
    }),
  })
  .put('/:id/entities/:entityId', ({ body, params }) => {
    return projectService.updateEntity(params.id, params.entityId, body);
  }, {
    params: z.object({
      id: z.uuid('Invalid project id'),
      entityId: z.uuid('Invalid entity id'),
    }),
    body: EntityObjectDTO,
  })
  .delete('/:id/entities/:entityId', ({ params }) => {
    return projectService.deleteEntity(params.entityId);
  }, {
    params: z.object({
      id: z.uuid('Invalid project id'),
      entityId: z.uuid('Invalid entity id'),
    }),
  })
  .post('/:id/entities/:entityId/regenerate', async ({ params }) => {
    return regenerateEntity(params.id, params.entityId);
  }, {
    params: z.object({
      id: z.uuid('Invalid project id'),
      entityId: z.uuid('Invalid entity id'),
    }),
  })
  .get('/:id/story-bible', ({ params }) => {
    return projectService.returnStoryBibleProse(params.id);
  }, {
    params: z.object({
      id: z.uuid('Invalid project id'),
    }),
    response: {
      200: projectModel.StoryBibleProseDTO,
    },
  })
  .put('/:id/story-bible', ({ body, params }) => {
    return projectService.saveStoryBibleProse(params.id, body);
  }, {
    params: z.object({
      id: z.uuid('Invalid project id'),
    }),
    body: projectModel.StoryBibleProseDTO,
    response: {
      200: projectModel.StoryBibleProseDTO,
    },
  })
  .get('/:id/scenes', ({ params }) => {
    return projectService.returnScriptProse(params.id);
  }, {
    params: z.object({
      id: z.uuid('Invalid project id'),
    }),
  })