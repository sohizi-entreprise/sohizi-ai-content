import { db } from "@/db";
import { FileNode, FileNodeContent, fileNodeContents, fileNodes, projects} from "@/db/schema";
import type { CursorPaginationOptions, CursorPaginationResult } from "@/type";
import { eq, desc, sql, lt } from "drizzle-orm";
import { createProjectSchema, projectBriefSchema } from "./schema";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { ORDER_GAP } from "../file-system/repo";
// Create the projects, list the project with pagination, delete a project, get a project by id, update a project

const DEFAULT_PROJECTS_PAGE_SIZE = 20;

export const createProject = async (data: z.infer<typeof createProjectSchema>) => {
  const metadata = {format: data.brief.format, genre: data.brief.genre};
  const result = await db.transaction(async (tx) => {
    // Create the project
    const response = await tx.insert(projects).values({
        title: data.title,
        metadata: metadata,
      }).returning();
    const project = response[0]
    // Create the root folder for the project
    const rootResponse = await tx.insert(fileNodes).values({
      projectId: project.id,
      name: 'root',
      directory: true,
    }).returning();
    const rootFolder = rootResponse[0]
    // Create initial files for the project
    const [builtInFolders, builtInFileContents] = createInitialFiles(project.id, rootFolder.id, data.brief);
    await tx.insert(fileNodes).values(builtInFolders).onConflictDoNothing();
    await tx.insert(fileNodeContents).values(builtInFileContents).onConflictDoNothing();

    return project;
  });

  return result;
}

export const updateProject = async (id: string, data: {title: string}) => {
  const result = await db.update(projects).set(data).where(eq(projects.id, id)).returning();
  return result[0];
}

export const getProjectById = async (id: string) => {
  const result = await db.select({
                            id: projects.id,
                            title: projects.title,
                            createdAt: projects.createdAt,
                            updatedAt: projects.updatedAt,
                            format: sql<string>`${projects.metadata}->>'format'`,
                            genre: sql<string>`${projects.metadata}->>'genre'`,
                          })
                          .from(projects)
                          .where(eq(projects.id, id));
  return result[0];
}

export const listProjects = async (
  options: CursorPaginationOptions = {}
): Promise<CursorPaginationResult<{
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  format: string;
  genre: string;
}>> => {
  const { cursor, limit = DEFAULT_PROJECTS_PAGE_SIZE } = options;
  const pageSize = Math.max(limit, 1);

  const baseQuery = db
    .select({
      id: projects.id,
      title: projects.title,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      format: sql<string>`${projects.metadata}->>'format'`,
      genre: sql<string>`${projects.metadata}->>'genre'`,
    })
    .from(projects);

  const rows = await (cursor
    ? baseQuery.where(lt(projects.createdAt, new Date(cursor)))
    : baseQuery)
    .orderBy(desc(projects.createdAt))
    .limit(pageSize + 1);

  const hasMore = rows.length > pageSize;
  const data = rows.slice(0, pageSize);
  const nextCursor =
    hasMore && data.length > 0 ? data[data.length - 1].createdAt.toISOString() : null;

  return { data, nextCursor, hasMore };
}

export const deleteProject = async (id: string) => {
  const resp = await db.delete(projects).where(eq(projects.id, id)).returning({id: projects.id});
  return resp.length > 0;
}

type FileDef = Omit<FileNode, 'createdAt' | 'updatedAt'>;
type FileContentDef = Pick<FileNodeContent, 'fileNodeId' | 'projectId' | 'content'>;

function createInitialFiles(projectId: string, rootFolderId: string, projectBrief: z.infer<typeof projectBriefSchema>): [FileDef[], FileContentDef[]] {
  const folders = ['admin', 'development', 'pre-production', 'production', 'assets']
  const builtInFolders: FileDef[] = folders.map((folder, index) => ({
    id: uuidv4(),
    name: folder,
    directory: true,
    projectId: projectId,
    parentId: rootFolderId,
    position: (index + 1) * ORDER_GAP,
    editable: false,
    format: null,
  }))

  const adminFolderId = builtInFolders[0].id;

  const briefFile: FileDef = {
    id: uuidv4(),
    name: 'brief',
    directory: false,
    projectId: projectId,
    parentId: adminFolderId,
    position: ORDER_GAP,
    editable: false,
    format: 'markdown',
  }

  // Let's create the brief content
  const briefFileContent: Pick<FileNodeContent, 'fileNodeId' | 'projectId' | 'content'> = {
    fileNodeId: briefFile.id,
    projectId: projectId,
    content: buildBriefFileContent(projectBrief),
  }
  
  builtInFolders.push(briefFile);

  return [builtInFolders, [briefFileContent]];

}


function buildBriefFileContent(projectBrief: z.infer<typeof projectBriefSchema>){
  const {format, genre, durationMin, tone, audience, storyIdea} = projectBrief;
  const content = `
# Project Brief
---
## Project Details
- **Format**: ${format}
- **Genre**: ${genre}
- **Duration**: ${durationMin == 1 ? '1 minute' : `${durationMin} minutes`}
- **Tone**: ${tone.join(', ')}
- **Audience**: ${audience}
---
## Story Idea
${storyIdea}
`;

  return content.trim();
}

