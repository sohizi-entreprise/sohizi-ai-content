import { db } from "@/db"
import { generationRequests } from "@/db/schema"
import type {
  GenerationRequestStatus,
  GenerationRequestType,
  GenerationRequestAsset,
} from "@/type"
import { and, eq, inArray, desc, sql } from "drizzle-orm"

type CreateGenerationRequestPayload = {
  projectId: string
  userId: string
  type: GenerationRequestType
  request: Record<string, unknown>
}

export const createGenerationRequest = async (
  payload: CreateGenerationRequestPayload,
) => {
  const result = await db.insert(generationRequests).values(payload).returning()
  return result[0]
}

export const updateGenerationRequest = async (
  id: string,
  data: {
    status?: GenerationRequestStatus
    error?: string
    history?: Record<string, unknown>[]
    request?: Record<string, unknown>
  },
) => {
  const result = await db
    .update(generationRequests)
    .set(data)
    .where(eq(generationRequests.id, id))
    .returning()
  return result[0]
}

export const appendRequestAssets = async (
  requestId: string,
  newAssets: GenerationRequestAsset[],
) => {
  await db
    .update(generationRequests)
    .set({
      assets: sql`coalesce(${generationRequests.assets}, '[]'::jsonb) || ${JSON.stringify(newAssets)}::jsonb`,
    })
    .where(eq(generationRequests.id, requestId))
}

export const appendRequestHistory = async (
  requestId: string,
  newHistory: Record<string, unknown>[],
) => {
  await db
    .update(generationRequests)
    .set({
      history: sql`coalesce(${generationRequests.history}, '[]'::jsonb) || ${JSON.stringify(newHistory)}::jsonb`,
    })
    .where(eq(generationRequests.id, requestId))
}

export const getGenerationRequestById = async (
  projectId: string,
  requestId: string,
) => {
  const result = await db
    .select()
    .from(generationRequests)
    .where(
      and(
        eq(generationRequests.id, requestId),
        eq(generationRequests.projectId, projectId),
      ),
    )
  return result[0]
}

export const getPendingRequests = async (projectId: string, userId: string) => {
  return db
    .select({
      id: generationRequests.id,
      status: generationRequests.status,
      type: generationRequests.type,
      request: generationRequests.request,
      createdAt: generationRequests.createdAt,
      updatedAt: generationRequests.updatedAt,
    })
    .from(generationRequests)
    .where(
      and(
        eq(generationRequests.projectId, projectId),
        eq(generationRequests.userId, userId),
        inArray(generationRequests.status, ["pending", "processing"]),
      ),
    )
    .orderBy(desc(generationRequests.createdAt))
}

export const deleteGenerationRequest = async (
  projectId: string,
  requestId: string,
) => {
  const result = await db
    .delete(generationRequests)
    .where(
      and(
        eq(generationRequests.id, requestId),
        eq(generationRequests.projectId, projectId),
      ),
    )
    .returning({ id: generationRequests.id })
  return result[0] ?? null
}

export const getGenerationRequestsByIds = async (
  projectId: string,
  requestIds: string[],
) => {
  return db
    .select({
      id: generationRequests.id,
      status: generationRequests.status,
      type: generationRequests.type,
      request: generationRequests.request,
      error: generationRequests.error,
      createdAt: generationRequests.createdAt,
      updatedAt: generationRequests.updatedAt,
    })
    .from(generationRequests)
    .where(
      and(
        eq(generationRequests.projectId, projectId),
        inArray(generationRequests.id, requestIds),
      ),
    )
}
