import { db } from "@/db"
import {
  fileNodeContents,
  fileNodes,
  organization,
  projectBriefs,
  projects,
  templates,
  videoCompositions,
} from "@/db/schema"
import type { CursorPaginationOptions, CursorPaginationResult } from "@/type"
import { eq, desc, asc, lt, and, isNull, or, gt } from "drizzle-orm"
import { createProjectSchema } from "./schema"
import { z } from "zod"
import { ORDER_GAP } from "../file-system/repo"
import { fileType } from "../file-system/constants"
import {
  joinLtree,
  normalizeFileNodeName,
  serializeFileNode,
} from "../file-system/utils"
import { RepositoryError } from "../error"
import { expireAssetsForProject } from "../media-engine/asset-retention"
import { DatabaseError } from "pg"
// Create the projects, list the project with pagination, delete a project, get a project by id, update a project

const DEFAULT_PROJECTS_PAGE_SIZE = 20

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

const isPgError = (error: unknown) => {
  return error instanceof DatabaseError && "code" in error && "detail" in error
}

export const createProject = async (
  data: z.infer<typeof createProjectSchema>,
  organizationId: string,
  briefContent = "",
) => {
  const result = await db.transaction(async (tx) => {
    const response = await tx
      .insert(projects)
      .values({
        title: data.title,
        organizationId,
      })
      .returning()
    const project = response[0]

    if ("presets" in data) {
      await tx.insert(projectBriefs).values({
        projectId: project.id,
        content: briefContent,
        additionalSettings: {
          presets: data.presets,
          commandId: data.commandId,
          modelId: data.modelId,
        },
      })
    }

    await createInitialFiles(tx, project.id, briefContent)

    return project
  })

  return result
}

type CreateTemplatePayload = {
  name: string
  slug: string
}

export const createTemplate = async (
  data: CreateTemplatePayload,
  organizationId: string,
) => {
  try {
    const { name, slug } = data
    const result = await db.transaction(async (tx) => {
      const newProject = await tx
        .insert(projects)
        .values({
          organizationId: organizationId,
          title: name,
          isTemplate: true,
        })
        .returning()
      const project = newProject[0]

      const newTemplate = await tx
        .insert(templates)
        .values({
          projectId: project.id,
          name,
          slug,
        })
        .returning()

      // Create the initial files for the project
      await createInitialFiles(tx, project.id)

      return { project, template: newTemplate[0] }
    })

    return result
  } catch (error) {
    if (isPgError(error)) {
      if (error.code === "23505") {
        throw new RepositoryError(
          "Template with this slug already exists",
          "Conflict",
        )
      }
      throw new RepositoryError("Failed to create template", "DbError")
    }
    throw error
  }
}

export const updateProject = async (id: string, data: { title: string }) => {
  const result = await db
    .update(projects)
    .set(data)
    .where(eq(projects.id, id))
    .returning()
  return result[0]
}

export const getProjectBrief = async (projectId: string) => {
  const result = await db
    .select({
      additionalSettings: projectBriefs.additionalSettings,
    })
    .from(projectBriefs)
    .where(eq(projectBriefs.projectId, projectId))
    .limit(1)
  return result[0] ?? null
}

export const getProjectById = async (id: string) => {
  const result = await db
    .select({
      id: projects.id,
      organizationId: projects.organizationId,
      title: projects.title,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .where(eq(projects.id, id))
  return result[0]
}

export const getProjectWithRootFiles = async (id: string) => {
  const result = await db.transaction(async (tx) => {
    const firstQuery = await tx
      .select({
        id: projects.id,
        title: projects.title,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .where(eq(projects.id, id))
    const project = firstQuery[0]
    if (!project) {
      throw new RepositoryError("Project not found", "NotFound")
    }

    const secondQuery = await tx
      .select({
        id: fileNodes.id,
      })
      .from(fileNodes)
      .where(and(eq(fileNodes.projectId, id), isNull(fileNodes.parentId)))
      .limit(1)
    const rootFolderId = secondQuery[0].id
    if (!rootFolderId) {
      throw new RepositoryError("Root folder not found", "NotFound")
    }
    const rootFiles = await tx
      .select({
        id: fileNodes.id,
        name: fileNodes.name,
        directory: fileNodes.directory,
        projectId: fileNodes.projectId,
        parentId: fileNodes.parentId,
        position: fileNodes.position,
        editable: fileNodes.editable,
        contentEditable: fileNodes.contentEditable,
        type: fileNodes.type,
        format: fileNodes.format,
        path: fileNodes.path,
      })
      .from(fileNodes)
      .where(
        and(eq(fileNodes.projectId, id), eq(fileNodes.parentId, rootFolderId)),
      )
      .orderBy(asc(fileNodes.position))
    return {
      project,
      rootFolderId,
      rootFiles: rootFiles.map(serializeFileNode),
    }
  })

  return result
}

export const listProjects = async (
  options: CursorPaginationOptions = {},
  organizationId: string,
): Promise<
  CursorPaginationResult<{
    id: string
    title: string
    createdAt: Date
    updatedAt: Date
  }>
> => {
  const { cursor, limit = DEFAULT_PROJECTS_PAGE_SIZE } = options
  const pageSize = Math.max(limit, 1)

  const baseConditions = cursor
    ? and(
        eq(projects.organizationId, organizationId),
        lt(projects.createdAt, new Date(cursor)),
      )
    : eq(projects.organizationId, organizationId)

  const rows = await db
    .select({
      id: projects.id,
      title: projects.title,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .where(baseConditions)
    .orderBy(desc(projects.createdAt))
    .limit(pageSize + 1)

  const hasMore = rows.length > pageSize
  const data = rows.slice(0, pageSize)
  const nextCursor =
    hasMore && data.length > 0
      ? data[data.length - 1].createdAt.toISOString()
      : null

  return { data, nextCursor, hasMore }
}

export const listTemplates = async (
  options: CursorPaginationOptions = {},
  organizationId: string,
): Promise<
  CursorPaginationResult<{
    id: string
    projectId: string
    name: string
    slug: string
    description: string | null
    thumbnail: string | null
    status: string
    visibility: string
    displayPriority: number
    createdAt: Date
    updatedAt: Date
  }>
> => {
  const { cursor, limit = DEFAULT_PROJECTS_PAGE_SIZE } = options
  const pageSize = Math.max(limit, 1)

  const baseConditions = cursor
    ? and(
        eq(projects.organizationId, organizationId),
        lt(templates.createdAt, new Date(cursor)),
      )
    : eq(projects.organizationId, organizationId)

  const rows = await db
    .select({
      id: templates.id,
      projectId: templates.projectId,
      name: templates.name,
      slug: templates.slug,
      description: templates.description,
      thumbnail: templates.thumbnail,
      status: templates.status,
      visibility: templates.visibility,
      displayPriority: templates.displayPriority,
      createdAt: templates.createdAt,
      updatedAt: templates.updatedAt,
    })
    .from(templates)
    .innerJoin(projects, eq(templates.projectId, projects.id))
    .where(baseConditions)
    .orderBy(desc(templates.createdAt))
    .limit(pageSize + 1)

  const hasMore = rows.length > pageSize
  const data = rows.slice(0, pageSize)
  const nextCursor =
    hasMore && data.length > 0
      ? data[data.length - 1].createdAt.toISOString()
      : null

  return { data, nextCursor, hasMore }
}

export const listPublishedTemplates = async (
  options: CursorPaginationOptions = {},
): Promise<
  CursorPaginationResult<{
    id: string
    projectId: string
    name: string
    slug: string
    description: string | null
    thumbnail: string | null
    status: string
    visibility: string
    displayPriority: number
    organizationId: string
    organizationName: string
    createdAt: Date
    updatedAt: Date
  }>
> => {
  const { cursor, limit = DEFAULT_PROJECTS_PAGE_SIZE } = options
  const pageSize = Math.max(limit, 1)
  const parsedCursor = parsePublishedTemplateCursor(cursor)

  const baseConditions = [
    eq(templates.status, "published"),
    eq(templates.visibility, "public"),
  ]

  if (parsedCursor) {
    baseConditions.push(
      or(
        gt(templates.displayPriority, parsedCursor.displayPriority),
        and(
          eq(templates.displayPriority, parsedCursor.displayPriority),
          lt(templates.createdAt, parsedCursor.createdAt),
        ),
      )!,
    )
  }

  const rows = await db
    .select({
      id: templates.id,
      projectId: templates.projectId,
      name: templates.name,
      slug: templates.slug,
      description: templates.description,
      thumbnail: templates.thumbnail,
      status: templates.status,
      visibility: templates.visibility,
      displayPriority: templates.displayPriority,
      organizationId: organization.id,
      organizationName: organization.name,
      createdAt: templates.createdAt,
      updatedAt: templates.updatedAt,
    })
    .from(templates)
    .innerJoin(projects, eq(templates.projectId, projects.id))
    .innerJoin(organization, eq(projects.organizationId, organization.id))
    .where(and(...baseConditions))
    .orderBy(asc(templates.displayPriority), desc(templates.createdAt))
    .limit(pageSize + 1)

  const hasMore = rows.length > pageSize
  const data = rows.slice(0, pageSize)
  const lastItem = data[data.length - 1]
  const nextCursor =
    hasMore && lastItem
      ? `${lastItem.displayPriority}|${lastItem.createdAt.toISOString()}`
      : null

  return { data, nextCursor, hasMore }
}

export const deleteProject = async (id: string) => {
  await expireAssetsForProject(id)
  const resp = await db
    .delete(projects)
    .where(eq(projects.id, id))
    .returning({ id: projects.id })
  return resp.length > 0
}

function parsePublishedTemplateCursor(cursor?: string) {
  if (!cursor) {
    return null
  }

  const [displayPriority, createdAt] = cursor.split("|", 2)
  const parsedDisplayPriority = Number(displayPriority)
  const parsedCreatedAt = new Date(createdAt)

  if (
    !Number.isFinite(parsedDisplayPriority) ||
    Number.isNaN(parsedCreatedAt.getTime())
  ) {
    return null
  }

  return {
    displayPriority: parsedDisplayPriority,
    createdAt: parsedCreatedAt,
  }
}

async function createInitialFiles(
  tx: DbTransaction,
  projectId: string,
  briefContent = "",
) {
  const resp1 = await tx
    .insert(fileNodes)
    .values({
      name: "root",
      directory: true,
      projectId: projectId,
      parentId: null,
      position: 0,
      editable: false,
      format: null,
      path: "root",
    })
    .returning()
  const rootFolder = resp1[0]

  const resp2 = await tx
    .insert(fileNodes)
    .values({
      name: "core",
      directory: true,
      projectId: projectId,
      parentId: rootFolder.id,
      position: ORDER_GAP,
      editable: false,
      format: null,
      path: joinLtree(rootFolder.path, "core"),
    })
    .returning()

  await tx.insert(fileNodes).values({
    name: "assets",
    directory: true,
    projectId: projectId,
    parentId: rootFolder.id,
    position: ORDER_GAP * 2,
    editable: false,
    format: null,
    path: joinLtree(rootFolder.path, "assets"),
  })

  const coreFolder = resp2[0]

  await tx.insert(fileNodes).values({
    name: "skills",
    directory: true,
    type: fileType.SKILL,
    projectId: projectId,
    parentId: coreFolder.id,
    position: ORDER_GAP,
    editable: false,
    format: null,
    path: joinLtree(coreFolder.path, "skills"),
  })

  const briefName = normalizeFileNodeName("brief", false)
  const [briefFile] = await tx
    .insert(fileNodes)
    .values({
      name: briefName,
      directory: false,
      projectId: projectId,
      parentId: coreFolder.id,
      position: ORDER_GAP,
      editable: false,
      contentEditable: true,
      type: "document",
      format: "markdown",
      path: joinLtree(coreFolder.path, briefName),
    })
    .returning()

  await tx.insert(fileNodeContents).values({
    fileNodeId: briefFile.id,
    projectId: projectId,
    content: briefContent,
  })

  // await createSecondaryFiles(tx, projectId, rootFolder.id)
}

// Those are files on the root folder, like image and video editors
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function createSecondaryFiles(
  tx: DbTransaction,
  projectId: string,
  rootFolderId: string,
) {
  const files = [
    // {name: 'media-generator', format: 'ai-generated', position: ORDER_GAP * 2},
    {
      name: "video-editor",
      type: "video-editor" as const,
      format: "json" as const,
      position: ORDER_GAP * 3,
    },
  ] as const

  for (const file of files) {
    const response = await tx
      .insert(fileNodes)
      .values({
        name: normalizeFileNodeName(file.name, false),
        directory: false,
        projectId: projectId,
        parentId: rootFolderId,
        position: file.position,
        editable: false,
        type: file.type,
        format: file.format,
        path: joinLtree("root", normalizeFileNodeName(file.name, false)),
      })
      .returning()
    const fileNode = response[0]
    if (fileNode.type === "video-editor") {
      await tx.insert(videoCompositions).values({
        projectId: projectId,
        fileNodeId: fileNode.id,
      })
    }
  }
}
