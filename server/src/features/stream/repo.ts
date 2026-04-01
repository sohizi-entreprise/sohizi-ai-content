import { db } from "@/db";
import { generationRequests } from "@/db/schema";
import { GenerationRequestStatus, GenerationRequestType } from "@/type";
import { and, eq, inArray } from "drizzle-orm";

type CreationPayload = {
    projectId: string;
    type: GenerationRequestType;
    metadata: Record<string, unknown>;
}

type UpdatePayload = {
    status: GenerationRequestStatus;
    error?: string;
}

export const createGenerationRequest = async (request: CreationPayload) => {
    const result = await db.insert(generationRequests).values(request).returning();
    return result[0];
}

export const updateGenerationRequest = async (id: string, request: UpdatePayload) => {
    const result = await db.update(generationRequests).set(request).where(eq(generationRequests.id, id)).returning();
    return result[0];
}

export const getActiveRequests = async(projectId: string) => {
    const result = await db.select({
        id: generationRequests.id,
        status: generationRequests.status,
        type: generationRequests.type,
        createdAt: generationRequests.createdAt,
        updatedAt: generationRequests.updatedAt,
    }).from(generationRequests).where(and(inArray(generationRequests.status, ['ENQUEUED', 'PROCESSING']), eq(generationRequests.projectId, projectId)));
    return result;
}

export const getGenerationRequestById = async(projectId: string, requestId: string) => {
    const result = await db.select().from(generationRequests).where(and(eq(generationRequests.id, requestId), eq(generationRequests.projectId, projectId)));
    return result[0];
}