import { db } from "@/db"
import { generationRequests } from "@/db/schema/base"
import { GenerationRequest, UpdateGenerationRequest } from "./model"
import { eq } from "drizzle-orm";

export const createGenerationRequest = async (request: GenerationRequest) => {
  const result = await db.insert(generationRequests).values(request).returning();
  return result[0];
}

export const getGenerationRequestById = async (id: string) => {
  const result = await db.select().from(generationRequests).where(eq(generationRequests.id, id));
  return result[0];
}

export const updateGenerationRequest = async (id: string, request: UpdateGenerationRequest) => {
  const result = await db.update(generationRequests).set(request).where(eq(generationRequests.id, id)).returning();
  return result[0];
}