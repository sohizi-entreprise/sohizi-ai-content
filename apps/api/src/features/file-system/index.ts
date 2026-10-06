import { Elysia } from "elysia"
import { z } from "zod"
import * as fileService from "./service"
import {
  fileCreationRequestSchema,
  fileNodeInsertPositionSchema,
  updateSkillRequestSchema,
  updateTextFileContentRequestSchema,
} from "./payload"
import { assertProjectAccess } from "@/lib/authorize"
import { authMiddleware } from "@/lib/auth-middleware"
import { FILE_FORMATS, FILE_TYPES, MEDIA_FILE_TYPES } from "./constants"

const projectParams = z.object({
  projectId: z.uuid("Invalid project id"),
})

const paramsSchema = z.object({
  projectId: z.uuid("Invalid project id"),
  id: z.uuid("Invalid file id"),
})

export const fileSystemRoutes = new Elysia({
  prefix: "/projects/:projectId/files",
})
  .guard({
    params: projectParams,
  })
  .use(authMiddleware)
  .resolve(async ({ params, user }) => {
    await assertProjectAccess(user.id, params.projectId)
    return {}
  })
  .post(
    "",
    ({ body }) => {
      return fileService.createFileNode(body)
    },
    {
      body: fileCreationRequestSchema,
    },
  )
  .get(
    "",
    ({ params, query }) => {
      return fileService.listFileTreePerLevel(params.projectId, query.parentId)
    },
    {
      params: projectParams,
      query: z.object({
        parentId: z.uuid("Invalid parent id"),
      }),
    },
  )
  .get(
    "/children",
    ({ params, query }) => {
      return fileService.listDirectoryChildren(
        params.projectId,
        query.parentId,
        {
          cursor: query.cursor,
          limit: query.limit,
        },
      )
    },
    {
      query: z.object({
        parentId: z.uuid("Invalid parent id"),
        cursor: z.string().min(1).optional(),
        limit: z.coerce.number().int().positive().max(100).optional(),
      }),
    },
  )
  .get(
    "/search",
    ({ params, query }) => {
      return fileService.searchFilesByName({
        projectId: params.projectId,
        name: query.name,
        limit: query.limit,
        directory: query.directory,
        type: query.type,
        format: query.format,
      })
    },
    {
      query: z.object({
        name: z.string().trim().min(1, "Search query is required"),
        limit: z.coerce.number().int().positive().optional(),
        directory: z
          .enum(["true", "false"])
          .transform((value) => value === "true")
          .optional(),
        type: z.enum(FILE_TYPES).optional(),
        format: z.enum(FILE_FORMATS).optional(),
      }),
    },
  )
  .get(
    "/by-type",
    ({ params, query }) => {
      return fileService.listFilesByType({
        projectId: params.projectId,
        type: query.type,
        limit: query.limit,
      })
    },
    {
      query: z.object({
        type: z.enum(FILE_TYPES),
        limit: z.coerce.number().int().positive().optional(),
      }),
    },
  )
  .get(
    "/by-format",
    ({ params, query }) => {
      return fileService.listFilesByFormat({
        projectId: params.projectId,
        format: query.format,
        limit: query.limit,
      })
    },
    {
      query: z.object({
        format: z.enum(FILE_FORMATS),
        limit: z.coerce.number().int().positive().optional(),
      }),
    },
  )
  .get(
    "/by-path",
    ({ params, query }) => {
      return fileService.getFileNodeByPath(params.projectId, query.path)
    },
    {
      query: z.object({
        path: z.string().trim().min(1, "Path is required"),
      }),
    },
  )
  .get(
    "/assets",
    ({ params, query }) => {
      return fileService.listAssetsFolder({
        projectId: params.projectId,
        name: query.name,
        type: query.type,
        limit: query.limit,
      })
    },
    {
      query: z.object({
        name: z.string().trim().min(1).optional(),
        type: z.enum(MEDIA_FILE_TYPES).optional(),
        limit: z.coerce.number().int().positive().optional(),
      }),
    },
  )
  .get("/pending-operations", ({ params }) => {
    return fileService.listPendingFileOperations(params.projectId)
  })
  .guard({
    params: paramsSchema,
  })
  .get(
    "/:id/media",
    ({ params, query }) => {
      return fileService.listFolderMedia(params.projectId, params.id, {
        type: query.type,
        limit: query.limit,
      })
    },
    {
      query: z.object({
        type: z.enum(MEDIA_FILE_TYPES).optional(),
        limit: z.coerce.number().int().positive().optional(),
      }),
    },
  )
  .get("/:id/node", ({ params }) => {
    return fileService.getFileNodeById(params.projectId, params.id)
  })
  .get("/:id", ({ params }) => {
    return fileService.getFileContent(params.projectId, params.id)
  })
  .delete("/:id", ({ params }) => {
    return fileService.deleteFileNode(params.projectId, params.id)
  })
  .put(
    "/:id/content",
    ({ params, body }) => {
      return fileService.updateFileContent(params.projectId, params.id, body)
    },
    {
      body: updateTextFileContentRequestSchema,
    },
  )
  .put(
    "/:id/skill",
    ({ params, body }) => {
      return fileService.updateSkill(params.projectId, params.id, body)
    },
    {
      body: updateSkillRequestSchema,
    },
  )
  .put(
    "/:id/rename",
    ({ params, body }) => {
      return fileService.updateFileNode(params.projectId, {
        id: params.id,
        name: body.name,
      })
    },
    {
      body: z.object({
        name: z.string().max(50, "Name must be less than 50 characters"),
      }),
    },
  )
  .put(
    "/:id/move",
    ({ params, body }) => {
      return fileService.updateFileNode(params.projectId, {
        id: params.id,
        parentId: body.parentId,
        anchorId: body.anchorId,
        position: body.position,
      })
    },
    {
      body: z.object({
        parentId: z.string().nullable().optional(),
        anchorId: z.string().nullable().optional(),
        position: fileNodeInsertPositionSchema,
      }),
    },
  )
  .get(
    "/:id/pending-operations",
    ({ params }) => {
      return fileService.getPendingFileOperation(params.projectId, params.id)
    },
    {
      params: paramsSchema,
    },
  )
  .delete(
    "/:id/pending-operations",
    ({ params }) => {
      return fileService.deletePendingFileOperation(params.projectId, params.id)
    },
    {
      params: paramsSchema,
    },
  )
