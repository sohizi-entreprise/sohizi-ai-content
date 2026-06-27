import { db } from "@/db";
import { generationRequests, assets, assetVariants, fileNodes, assetsAgentRuns } from "@/db/schema";
import type { AssetType, AssetSource, AssetStatus, AssetVariantType, AssetMetadata, CursorPaginationOptions, CursorPaginationResult, AgentRunStatus, GenerationRequestAsset, AgentRunMessage } from "@/type";
import { and, eq, desc, lt, sql } from "drizzle-orm";


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


export const createAssetRequest = async (projectId: string, settings?: Record<string, unknown>) => {
    const result = await db.insert(assetsAgentRuns).values({
        projectId,
        status: 'pending',
        assets: [],
        messages: [],
        metadata: {settings: settings ?? {}},
    }).returning();

    return result[0];
}

type UpdateAssetRequestPayload = {
    status?: AgentRunStatus;
    assets?: GenerationRequestAsset[];
    messages?: AgentRunMessage[];
    metadata?: {settings: Record<string, unknown>};
    error?: string;
}

export const updateAssetRequest = async (runId: string, data: UpdateAssetRequestPayload) => {
    const result = await db.update(assetsAgentRuns)
    .set(data)
    .where(eq(assetsAgentRuns.id, runId))
    .returning();

    return result[0];
}

export const appendAssetRequestAssets = async (runId: string, newAssets: GenerationRequestAsset[]) => {
    return await db.transaction(async (tx) => {
        const response = await tx.select().from(assetsAgentRuns).where(eq(assetsAgentRuns.id, runId));
        const agentRun = response[0];
        if(!agentRun){
            throw new Error('Agent run not found');
        }
        const assets = [...(agentRun.assets ?? []), ...newAssets];
        const result = await tx.update(assetsAgentRuns)
                                .set({
                                    assets,
                                })
                                .where(eq(assetsAgentRuns.id, runId))
                                .returning();
        return result[0];
    })
}


const DEFAULT_MESSAGES_PAGE_SIZE = 20;
const MAX_MESSAGES_PAGE_SIZE = 50;

type ListAssetRequestAssetsResult = {
    data: typeof assetsAgentRuns.$inferSelect[];
    nextCursor: string | null;
    hasMore: boolean;
}

export const listAssetRequestAssets = async (
    projectId: string,
    options?: CursorPaginationOptions
  ): Promise<ListAssetRequestAssetsResult> => {
    const limit = Math.min(options?.limit ?? DEFAULT_MESSAGES_PAGE_SIZE, MAX_MESSAGES_PAGE_SIZE);
    const cursor = options?.cursor;
  
    const rows = await db
      .select()
      .from(assetsAgentRuns)
      .where(
        cursor
          ? and(
              eq(assetsAgentRuns.projectId, projectId),
              lt(assetsAgentRuns.createdAt, new Date(cursor))
            )
          : eq(assetsAgentRuns.projectId, projectId)
      )
      .orderBy(desc(assetsAgentRuns.createdAt))
      .limit(limit + 1);
  
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const nextCursor =
      hasMore && page.length > 0 ? String(page[0].createdAt.toISOString()) : null;
  
    return { data: page, nextCursor, hasMore };
  }
