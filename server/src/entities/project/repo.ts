import { db } from "@/db";
import { projects } from "@/db/schema";
import { CreateProject, UpdateProject } from "./model";
import { eq, desc } from "drizzle-orm";

export const createProject = async (data: CreateProject) => {
  const result = await db.insert(projects).values({
    title: data.title,
    brief: data.brief ?? null,
  }).returning();
  return result[0];
}

export const updateProject = async (id: string, data: UpdateProject) => {
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
      status: projects.status,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .orderBy(desc(projects.createdAt));
  
  return result;
}

export const deleteProject = async (id: string) => {
  const resp = await db.delete(projects).where(eq(projects.id, id)).returning({id: projects.id});
  return resp.length > 0;
}
