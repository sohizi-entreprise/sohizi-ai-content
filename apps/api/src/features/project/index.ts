import { Elysia } from "elysia"
import { z } from "zod"
import * as projectService from "./service"
import { getCommands, toPublicCommands } from "@/catalog/commands"
import {
  filterPresets,
  generationTargets,
  getPresets,
  toPublicPresets,
} from "@/catalog/presets"
import {
  createProjectSchema,
  createTemplateSchema,
  estimateModelPreferenceSchema,
  updateModelPreferenceSchema,
  updateProjectSchema,
} from "./schema"
import {
  estimateModelPreferenceSelection,
  getProjectModelPreferences,
  updateProjectModelPreference,
} from "./model-preferences"
import { assertProjectAccess, requireActiveOrganization } from "@/lib/authorize"
import { authMiddleware } from "@/lib/auth-middleware"

export const projectRoutes = new Elysia({ prefix: "/projects" })
  .get(
    "/options",
    async ({ query }) => {
      const [presets, commands] = await Promise.all([
        getPresets(),
        getCommands(),
      ])
      return {
        presets: toPublicPresets(
          filterPresets(presets, query.generationTarget),
        ),
        commands: toPublicCommands(commands),
      }
    },
    {
      query: z.object({
        generationTarget: z.enum(generationTargets).optional(),
      }),
    },
  )
  .get(
    "/templates/published",
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
    "",
    ({ body, session }) => {
      const organizationId = requireActiveOrganization(session)
      return projectService.startProject(body, organizationId)
    },
    {
      body: createProjectSchema,
    },
  )
  .get(
    "",
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
    "/templates",
    ({ body, session }) => {
      const organizationId = requireActiveOrganization(session)
      return projectService.createTemplate(body, organizationId)
    },
    {
      body: createTemplateSchema,
    },
  )
  .get(
    "/templates",
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
    "/:projectId",
    async ({ params, user }) => {
      await assertProjectAccess(user.id, params.projectId)
      return projectService.getProject(params.projectId)
    },
    {
      params: z.object({
        projectId: z.uuid("Invalid project id"),
      }),
    },
  )
  .put(
    "/:projectId",
    async ({ body, params, user }) => {
      await assertProjectAccess(user.id, params.projectId)
      return projectService.updateProject(params.projectId, body)
    },
    {
      params: z.object({
        projectId: z.uuid("Invalid project id"),
      }),
      body: updateProjectSchema,
    },
  )
  .delete(
    "/:projectId",
    async ({ params, query, user }) => {
      await assertProjectAccess(user.id, params.projectId)
      return projectService.deleteProject({
        id: params.projectId,
        title: query.title,
      })
    },
    {
      params: z.object({
        projectId: z.uuid("Invalid project id"),
      }),
      query: z.object({
        title: z.string().min(1, "Title is required"),
      }),
    },
  )
  .get(
    "/:projectId/model-preferences",
    async ({ params, user }) => {
      await assertProjectAccess(user.id, params.projectId)
      const preferences = await getProjectModelPreferences(params.projectId)
      return { preferences }
    },
    {
      params: z.object({
        projectId: z.uuid("Invalid project id"),
      }),
    },
  )
  .post(
    "/:projectId/model-preferences/estimate",
    async ({ body, params, user }) => {
      await assertProjectAccess(user.id, params.projectId)
      return estimateModelPreferenceSelection(body)
    },
    {
      params: z.object({
        projectId: z.uuid("Invalid project id"),
      }),
      body: estimateModelPreferenceSchema,
    },
  )
  .patch(
    "/:projectId/model-preferences",
    async ({ body, params, user }) => {
      await assertProjectAccess(user.id, params.projectId)
      const preference = await updateProjectModelPreference(
        params.projectId,
        body,
      )
      return { preference }
    },
    {
      params: z.object({
        projectId: z.uuid("Invalid project id"),
      }),
      body: updateModelPreferenceSchema,
    },
  )
