import { db } from "@/db";
import { generationRequests, assets, assetVariants, fileNodes } from "@/db/schema";
import type { GenerationRequestStatus, GenerationRequestType, AssetType, AssetSource, AssetStatus, AssetVariantType, AssetMetadata, CursorPaginationOptions, CursorPaginationResult } from "@/type";
import { and, eq, inArray, desc, lt, sql } from "drizzle-orm";

type CreateGenerationRequestPayload = {
    projectId: string;
    userId: string;
    type: GenerationRequestType;
    request: Record<string, unknown>;
}

type CreateAssetPayload = {
    projectId: string;
    name: string;
    type: AssetType;
    url: string;
    storageKey: string;
    source: AssetSource;
    metadata: AssetMetadata;
    generationRequestId?: string;
}

type CreateAssetVariantPayload = {
    assetId: string;
    type: AssetVariantType;
    storageKey: string;
    url: string;
    metadata?: AssetMetadata;
    size: number;
    status: AssetStatus;
    blurhash?: string;
}

type CreateAssetWithFileNodePayload = {
    projectId: string;
    name: string;
    type: AssetType;
    url: string;
    source: AssetSource;
    folderId: string;
    storageKey: string;
    metadata: AssetMetadata;
    filePosition: number;
}

export const createGenerationRequest = async (payload: CreateGenerationRequestPayload) => {
    const result = await db.insert(generationRequests).values(payload).returning();
    return result[0];
}

export const updateGenerationRequest = async (
    id: string,
    data: { status: GenerationRequestStatus; error?: string },
) => {
    const result = await db
        .update(generationRequests)
        .set(data)
        .where(eq(generationRequests.id, id))
        .returning();
    return result[0];
}

export const getGenerationRequestById = async (projectId: string, requestId: string) => {
    const result = await db
        .select()
        .from(generationRequests)
        .where(and(eq(generationRequests.id, requestId), eq(generationRequests.projectId, projectId)));
    return result[0];
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
                inArray(generationRequests.status, ['pending', 'processing']),
            ),
        )
        .orderBy(desc(generationRequests.createdAt));
}

export const getGenerationRequestsByIds = async (projectId: string, requestIds: string[]) => {
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
        );
}

export const createAsset = async (payload: CreateAssetPayload) => {
    const result = await db.insert(assets).values(payload).returning();
    return result[0];
}

export const createAssetVariant = async (payload: CreateAssetVariantPayload) => {
    const result = await db.insert(assetVariants).values(payload).returning();
    return result[0];
}

export const getAssetsByProject = async (
    projectId: string,
    options?: { type?: AssetType; cursor?: string; limit?: number },
) => {
    const { type, cursor, limit = 20 } = options ?? {};
    const pageSize = Math.max(limit, 1);

    const conditions = [eq(assets.projectId, projectId)];
    if (type) conditions.push(eq(assets.type, type));
    if (cursor) conditions.push(lt(assets.createdAt, new Date(cursor)));

    const rows = await db
        .select()
        .from(assets)
        .where(and(...conditions))
        .orderBy(desc(assets.createdAt))
        .limit(pageSize + 1);

    const hasMore = rows.length > pageSize;
    const data = rows.slice(0, pageSize);
    const nextCursor = hasMore && data.length > 0
        ? data[data.length - 1].createdAt.toISOString()
        : null;

    return { data, nextCursor, hasMore };
}

export const createAssetWithFileNode = async (payload: CreateAssetWithFileNodePayload) => {
    const { projectId, name, type, url, source, folderId, metadata, storageKey, filePosition } = payload;

    const result = await db.transaction(async (tx) => {
        const filePayload = {
            projectId,
            name,
            parentId: folderId,
            format: type,
            editable: true,
            position: filePosition
        }
        const fileNodeResponse = await tx.insert(fileNodes).values(filePayload).returning();
        const fileNode = fileNodeResponse[0];
        if(!fileNode){
            throw new Error('Failed to create file node');
        }
        const assetPayload = {
            projectId,
            name,
            type,
            url,
            source,
            fileNodeId: fileNode.id,
            metadata,
            storageKey,
        }
        const assetResponse = await tx.insert(assets).values(assetPayload).returning();
        const asset = assetResponse[0];
        if(!asset){
            throw new Error('Failed to create asset');
        }
        return { asset, fileNode };
    });
    return result;
}

export const getAssetByFileNodeId = async (projectId: string, fileNodeId: string) => {
    const result = await db.select().from(assets).where(and(eq(assets.projectId, projectId), eq(assets.fileNodeId, fileNodeId)));
    return result[0];
}

type AiGeneratedAssetGroup = {
    requestId: string;
    request: Record<string, unknown> | null;
    createdAt: Date;
    assets: Array<{
        id: string;
        name: string;
        url: string;
        type: AssetType;
        createdAt: string;
        storageKey: string;
    }>;
}

export const getAiGeneratedAssetsGroupedByGenerationRequest = async (
    projectId: string,
    options: CursorPaginationOptions = {},
): Promise<CursorPaginationResult<AiGeneratedAssetGroup>> => {
    const { cursor, limit = 50 } = options;
    const pageSize = Math.max(limit, 1);

    const conditions = [
        eq(generationRequests.projectId, projectId),
        eq(assets.projectId, projectId),
        eq(assets.source, 'ai-generated' as AssetSource),
    ];
    if (cursor) conditions.push(lt(generationRequests.createdAt, new Date(cursor)));

    const rows = await db
        .select({
            requestId: generationRequests.id,
            request: sql<AiGeneratedAssetGroup['request']>`(array_agg(${generationRequests.request}))[1]`,
            createdAt: sql<Date>`max(${generationRequests.createdAt})`,
            assets: sql<AiGeneratedAssetGroup['assets']>`
                jsonb_agg(
                    jsonb_build_object(
                        'id', ${assets.id},
                        'name', ${assets.name},
                        'url', ${assets.url},
                        'type', ${assets.type},
                        'createdAt', ${assets.createdAt},
                        'storageKey', ${assets.storageKey}
                    )
                    order by ${assets.createdAt} desc
                )
            `,
        })
        .from(generationRequests)
        .innerJoin(assets, eq(assets.generationRequestId, generationRequests.id))
        .where(and(...conditions))
        .groupBy(generationRequests.id)
        .orderBy(desc(sql`max(${generationRequests.createdAt})`))
        .limit(pageSize + 1);

    const hasMore = rows.length > pageSize;
    const data = rows.slice(0, pageSize);
    const nextCursor = hasMore && data.length > 0
        ? data[data.length - 1].createdAt.toISOString()
        : null;

    return { data, nextCursor, hasMore };
}
