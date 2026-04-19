import { db } from "@/db";
import { projects} from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { ProjectCreationRequest } from "./payload";

export const createProject = async (data: Pick<ProjectCreationRequest, 'title'>) => {
  const result = await db.insert(projects).values({
    title: data.title,
  }).returning();
  return result[0];
}

export const updateProject = async (id: string, data: {title: string}) => {
  const result = await db.update(projects).set(data).where(eq(projects.id, id)).returning();
  return result[0];
}

export const getProjectById = async (id: string) => {
  const result = await db.select().from(projects).where(eq(projects.id, id));
  return result[0];
}

export const listProjects = async () => {
  const result = await db
    .select({
      id: projects.id,
      title: projects.title,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      format: sql<string>`${projects.metadata}->>'format'`,
      genre: sql<string>`${projects.metadata}->>'genre'`,
    })
    .from(projects)
    .orderBy(desc(projects.createdAt));
  
  return result;
}

export const deleteProject = async (id: string) => {
  const resp = await db.delete(projects).where(eq(projects.id, id)).returning({id: projects.id});
  return resp.length > 0;
}


