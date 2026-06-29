import { db } from "@/db";
import { FileNode, FileNodeContent, fileNodeContents, fileNodes, organization, projectBriefs, projects, templates, videoCompositions} from "@/db/schema";
import type { CursorPaginationOptions, CursorPaginationResult } from "@/type";
import { eq, desc, asc, lt, and, isNull, or, gt } from "drizzle-orm";
import { createProjectSchema } from "./schema";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { ORDER_GAP } from "../file-system/repo";
import { RepositoryError } from "../error";
// import { DatabaseError } from "pg";
import { DatabaseError } from 'pg-protocol';
// Create the projects, list the project with pagination, delete a project, get a project by id, update a project

const DEFAULT_PROJECTS_PAGE_SIZE = 20;

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const isPgError = (error: unknown) => {
  return error instanceof DatabaseError && 'code' in error && 'detail' in error;
}


export const createProject = async (data: z.infer<typeof createProjectSchema>, organizationId: string) => {
  // const metadata = {format: data.brief.format, genre: data.additionalSettings.genre?.value || ''};
  const result = await db.transaction(async (tx) => {
    const response = await tx.insert(projects).values({
        title: data.title,
        organizationId,
      }).returning();
    const project = response[0]

    // Populate the project brief
    const {format, durationMin, storyIdea} = data.brief;
    const additionalSettings = {format, durationMin, ...data.additionalSettings};
    await tx.insert(projectBriefs).values({
      projectId: project.id,
      content: storyIdea,
      additionalSettings,
    });

    // Create initial files for the project
    await createFileFromTemplate(tx, data.templateId, project.id);

    return project;
  });

  return result;
}

type CreateTemplatePayload = {
  name: string;
  slug: string;
}

export const createTemplate = async (data: CreateTemplatePayload, organizationId: string) => {
  try {
    const {name, slug} = data;
    const result = await db.transaction(async (tx) => {
      const newProject = await tx.insert(projects).values({
        organizationId: organizationId,
        title: name,
        isTemplate: true,
      }).returning();
      const project = newProject[0];

      const newTemplate = await tx.insert(templates).values({
        projectId: project.id,
        name,
        slug,
      }).returning();

      // Create the initial files for the project
      await createInitialFiles(tx, project.id);

      return {project, template: newTemplate[0]};
    });
    
  
    return result;
  } catch (error) {
    if (isPgError(error)) {
      if (error.code === '23505') {
        throw new RepositoryError('Template with this slug already exists', 'Conflict');
      }
      throw new RepositoryError('Failed to create template', 'DbError');
    }
    throw error;
  }
}

export const updateProject = async (id: string, data: {title: string}) => {
  const result = await db.update(projects).set(data).where(eq(projects.id, id)).returning();
  return result[0];
}

export const getProjectById = async (id: string) => {
  const result = await db.select({
                            id: projects.id,
                            organizationId: projects.organizationId,
                            title: projects.title,
                            createdAt: projects.createdAt,
                            updatedAt: projects.updatedAt,
                          })
                          .from(projects)
                          .where(eq(projects.id, id));
  return result[0];
}

export const getProjectWithRootFiles = async (id: string) => {

  const result = await db.transaction(async (tx) => {
    const firstQuery = await tx.select({
      id: projects.id,
      title: projects.title,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    }).from(projects).where(eq(projects.id, id));
    const project = firstQuery[0];
    if (!project) {
      throw new RepositoryError('Project not found', 'NotFound');
    }

    const secondQuery = await tx.select({
      id: fileNodes.id
    }).from(fileNodes).where(and(eq(fileNodes.projectId, id), isNull(fileNodes.parentId))).limit(1);
    const rootFolderId = secondQuery[0].id;
    if (!rootFolderId) {
      throw new RepositoryError('Root folder not found', 'NotFound');
    }
    const rootFiles = await tx.select({
      id: fileNodes.id,
      name: fileNodes.name,
      directory: fileNodes.directory,
      projectId: fileNodes.projectId,
      parentId: fileNodes.parentId,
      position: fileNodes.position,
      editable: fileNodes.editable,
      format: fileNodes.format,
    }).from(fileNodes).where(and(eq(fileNodes.projectId, id), eq(fileNodes.parentId, rootFolderId))).orderBy(asc(fileNodes.position));
    return { project, rootFolderId, rootFiles };
  })

  return result;
}

export const listProjects = async (
  options: CursorPaginationOptions = {},
  organizationId: string
): Promise<CursorPaginationResult<{
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}>> => {
  const { cursor, limit = DEFAULT_PROJECTS_PAGE_SIZE } = options;
  const pageSize = Math.max(limit, 1);

  const baseConditions = cursor
    ? and(eq(projects.organizationId, organizationId), lt(projects.createdAt, new Date(cursor)))
    : eq(projects.organizationId, organizationId);

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
    .limit(pageSize + 1);

  const hasMore = rows.length > pageSize;
  const data = rows.slice(0, pageSize);
  const nextCursor =
    hasMore && data.length > 0 ? data[data.length - 1].createdAt.toISOString() : null;

  return { data, nextCursor, hasMore };
}

export const listTemplates = async (
  options: CursorPaginationOptions = {},
  organizationId: string
): Promise<CursorPaginationResult<{
  id: string;
  projectId: string;
  name: string;
  slug: string;
  description: string | null;
  thumbnail: string | null;
  status: string;
  visibility: string;
  displayPriority: number;
  createdAt: Date;
  updatedAt: Date;
}>> => {
  const { cursor, limit = DEFAULT_PROJECTS_PAGE_SIZE } = options;
  const pageSize = Math.max(limit, 1);

  const baseConditions = cursor
    ? and(eq(projects.organizationId, organizationId), lt(templates.createdAt, new Date(cursor)))
    : eq(projects.organizationId, organizationId);

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
    .limit(pageSize + 1);

  const hasMore = rows.length > pageSize;
  const data = rows.slice(0, pageSize);
  const nextCursor =
    hasMore && data.length > 0 ? data[data.length - 1].createdAt.toISOString() : null;

  return { data, nextCursor, hasMore };
}

export const listPublishedTemplates = async (
  options: CursorPaginationOptions = {},
): Promise<CursorPaginationResult<{
  id: string;
  projectId: string;
  name: string;
  slug: string;
  description: string | null;
  thumbnail: string | null;
  status: string;
  visibility: string;
  displayPriority: number;
  organizationId: string;
  organizationName: string;
  createdAt: Date;
  updatedAt: Date;
}>> => {
  const { cursor, limit = DEFAULT_PROJECTS_PAGE_SIZE } = options;
  const pageSize = Math.max(limit, 1);
  const parsedCursor = parsePublishedTemplateCursor(cursor);

  const baseConditions = [
    eq(templates.status, 'published'),
    eq(templates.visibility, 'public'),
  ];

  if (parsedCursor) {
    baseConditions.push(
      or(
        gt(templates.displayPriority, parsedCursor.displayPriority),
        and(
          eq(templates.displayPriority, parsedCursor.displayPriority),
          lt(templates.createdAt, parsedCursor.createdAt),
        ),
      )!,
    );
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
    .limit(pageSize + 1);

  const hasMore = rows.length > pageSize;
  const data = rows.slice(0, pageSize);
  const lastItem = data[data.length - 1];
  const nextCursor =
    hasMore && lastItem
      ? `${lastItem.displayPriority}|${lastItem.createdAt.toISOString()}`
      : null;

  return { data, nextCursor, hasMore };
}

export const deleteProject = async (id: string) => {
  const resp = await db.delete(projects).where(eq(projects.id, id)).returning({id: projects.id});
  return resp.length > 0;
}

function parsePublishedTemplateCursor(cursor?: string) {
  if (!cursor) {
    return null;
  }

  const [displayPriority, createdAt] = cursor.split('|', 2);
  const parsedDisplayPriority = Number(displayPriority);
  const parsedCreatedAt = new Date(createdAt);

  if (!Number.isFinite(parsedDisplayPriority) || Number.isNaN(parsedCreatedAt.getTime())) {
    return null;
  }

  return {
    displayPriority: parsedDisplayPriority,
    createdAt: parsedCreatedAt,
  };
}

async function createInitialFiles(tx: DbTransaction, projectId: string) {
  const resp1 = await tx.insert(fileNodes).values({
    name: 'root',
    directory: true,
    projectId: projectId,
    parentId: null,
    position: 0,
    editable: false,
    format: null,
  }).returning();
  const rootFolder = resp1[0];

  const resp2 = await tx.insert(fileNodes).values({
    name: 'core',
    directory: true,
    projectId: projectId,
    parentId: rootFolder.id,
    position: ORDER_GAP,
    editable: false,
    format: null,
  }).returning();

  const resp3 = await tx.insert(fileNodes).values({
    name: 'assets',
    directory: true,
    projectId: projectId,
    parentId: rootFolder.id,
    position: ORDER_GAP * 2,
    editable: false,
    format: null,
  }).returning();

  const coreFolder = resp2[0];
  const assetsFolder = resp3[0];

  await tx.insert(fileNodes).values({
    name: 'skills',
    directory: true,
    projectId: projectId,
    parentId: coreFolder.id,
    position: ORDER_GAP,
    editable: false,
    format: null,
  });

  await tx.insert(fileNodes).values({
    name: 'uploads',
    directory: true,
    projectId: projectId,
    parentId: assetsFolder.id,
    position: ORDER_GAP,
    editable: false,
    format: null,
  });
  
  const resp4 = await tx.insert(fileNodes).values({
    name: 'context',
    directory: false,
    projectId: projectId,
    parentId: coreFolder.id,
    position: ORDER_GAP,
    editable: false,
    format: 'markdown',
  }).returning();

  const instructionFile = resp4[0];

  await tx.insert(fileNodeContents).values({
    fileNodeId: instructionFile.id,
    projectId: projectId,
    content: getDefaultInstructionFileContent(),
  });

  await createSecondaryFiles(tx, projectId, rootFolder.id);
}

async function createFileFromTemplate(tx: DbTransaction, templateId: string, newProjectId: string){
  const templateResponse = await tx.select().from(templates).where(eq(templates.id, templateId));
  const template = templateResponse[0];
  if (!template) {
    throw new RepositoryError('Template not found', 'NotFound');
  }

  const templateFiles = await tx.select().from(fileNodes).where(eq(fileNodes.projectId, template.projectId));
  if (templateFiles.length === 0) {
    return;
  }

  const fileNodeIdMap = new Map<string, string>();
  for (const file of templateFiles) {
    fileNodeIdMap.set(file.id, uuidv4());
  }

  const copiedFiles = await tx.insert(fileNodes).values(
    templateFiles.map((file) => ({
      id: fileNodeIdMap.get(file.id)!,
      name: file.name,
      directory: file.directory,
      projectId: newProjectId,
      parentId: file.parentId ? fileNodeIdMap.get(file.parentId) ?? null : null,
      position: file.position,
      editable: file.editable,
      format: file.format,
    })),
  ).returning();

  const rootFolder = copiedFiles.find((file) => file.parentId === null && file.directory && file.name === 'root');
  if (!rootFolder) {
    throw new RepositoryError('Root folder not found', 'NotFound');
  }

  const templateFileContents = await tx
    .select()
    .from(fileNodeContents)
    .where(eq(fileNodeContents.projectId, template.projectId));

  const copiedFileContents = templateFileContents
    .filter((content) => fileNodeIdMap.has(content.fileNodeId))
    .map((content) => ({
      fileNodeId: fileNodeIdMap.get(content.fileNodeId)!,
      projectId: newProjectId,
      content: content.content,
      metadata: content.metadata,
    }));

  if (copiedFileContents.length > 0) {
    await tx.insert(fileNodeContents).values(copiedFileContents);
  }

  await createSecondaryFiles(tx, newProjectId, rootFolder.id);
}

// Those are files on the root folder, like image and video editors
async function createSecondaryFiles(tx: DbTransaction, projectId: string, rootFolderId: string){
  const files = [
    // {name: 'media-generator', format: 'ai-generated', position: ORDER_GAP * 2},
    {name: 'video-editor', format: 'video-editor', position: ORDER_GAP * 3},
  ] as const;

  for (const file of files) {
    const response = await tx.insert(fileNodes).values({
      name: file.name,
      directory: false,
      projectId: projectId,
      parentId: rootFolderId,
      position: file.position,
      editable: false,
      format: file.format,
    }).returning();
    const fileNode = response[0];
    if (fileNode.format === 'video-editor') {
      await tx.insert(videoCompositions).values({
        projectId: projectId,
        fileNodeId: fileNode.id,
      });
    }
}
}

function getDefaultInstructionFileContent(){
  return `
# What is this instruction file
---
This file is loaded into the AI agent's context. It helps the AI agent to have a full context on how to structure and reference folder and projects
# This is an example template for the instruction file. [Feel free to edit this file to your needs]
---
TBD
`;
}


