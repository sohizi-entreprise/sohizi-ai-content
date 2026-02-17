import { db } from "@/db";
import { projects, shots } from "@/db/schema";
import { CreateProject, UpdateProject } from "./model";
import { eq, sql, desc } from "drizzle-orm";

export const createProject = async (project: CreateProject) => {
  const result = await db.insert(projects).values(project).returning();
  return result[0];
}

export const updateProject = async (id: string, project: UpdateProject) => {
  const result = await db.update(projects).set(project).where(eq(projects.id, id)).returning();
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
      name: projects.name,
      format: projects.format,
      genre: projects.genre,
      createdAt: projects.createdAt,
      shotCount: sql<number>`CAST(COUNT(DISTINCT ${shots.id}) AS INTEGER)`,
    })
    .from(projects)
    .leftJoin(shots, eq(projects.id, shots.projectId))
    .groupBy(projects.id)
    .orderBy(desc(projects.createdAt));
  
  return result;
}

export const deleteProject = async (id: string) => {
  const resp = await db.delete(projects).where(eq(projects.id, id)).returning({id: projects.id});
  return resp.length > 0;
}