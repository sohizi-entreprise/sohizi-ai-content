import { db } from "@/db";
import { assets, assetVariants, fileNodes, assetsAgentRuns } from "@/db/schema";
import type { AssetType, AssetSource, AssetStatus, AssetVariantType, AssetMetadata, CursorPaginationOptions, CursorPaginationResult, AgentRunStatus, AgentRunMessage } from "@/type";
import { UserModelMessage } from "ai";
import { and, eq, desc, lt, isNull, max, inArray } from "drizzle-orm";
import { v4 as uuidv4 } from 'uuid';
import { ORDER_GAP } from "../file-system/repo";


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
        const existingFileNodeResponse = await tx.select()
            .from(fileNodes)
            .where(and(
                eq(fileNodes.projectId, projectId),
                eq(fileNodes.parentId, folderId),
                eq(fileNodes.name, name),
            ))
            .limit(1);
        const existingFileNode = existingFileNodeResponse[0];

        if (existingFileNode) {
            if (existingFileNode.directory) {
                throw new Error('Cannot overwrite a directory with an asset');
            }

            const updatedFileNodeResponse = await tx.update(fileNodes)
                .set({
                    format: type,
                    editable: true,
                })
                .where(and(
                    eq(fileNodes.projectId, projectId),
                    eq(fileNodes.id, existingFileNode.id),
                ))
                .returning();
            const fileNode = updatedFileNodeResponse[0] ?? existingFileNode;

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

            const assetResponse = await tx.update(assets)
                .set(assetPayload)
                .where(and(
                    eq(assets.projectId, projectId),
                    eq(assets.fileNodeId, fileNode.id),
                ))
                .returning();
            const asset = assetResponse[0] ?? (await tx.insert(assets).values(assetPayload).returning())[0];
            if(!asset){
                throw new Error('Failed to upsert asset');
            }

            return { asset, fileNode };
        }

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

type AiGeneratedAsset = {
    id: string;
    projectId: string;
    name: string;
    url: string;
    type: AssetType;
    createdAt: Date;
    storageKey: string;
}

type ListAiGeneratedAssetsOptions = CursorPaginationOptions & {
    type?: AssetType;
}

export const listAiGeneratedAssets = async (
    projectId: string,
    options: ListAiGeneratedAssetsOptions = {},
): Promise<CursorPaginationResult<AiGeneratedAsset>> => {
    const { cursor, limit = 50, type } = options;
    const pageSize = Math.max(limit, 1);

    const conditions = [
        eq(assets.projectId, projectId),
        eq(assets.source, 'ai-generated' as AssetSource),
        isNull(assets.fileNodeId),
    ];
    if (type) conditions.push(eq(assets.type, type));
    if (cursor) conditions.push(lt(assets.createdAt, new Date(cursor)));

    const rows = await db
        .select({
            id: assets.id,
            projectId: assets.projectId,
            name: assets.name,
            url: assets.url,
            type: assets.type,
            createdAt: assets.createdAt,
            storageKey: assets.storageKey,
        })
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


export const createAssetRequest = async (projectId: string, userPrompt: UserModelMessage, settings?: Record<string, unknown>) => {
    const result = await db.insert(assetsAgentRuns).values({
        projectId,
        status: 'pending',
        messages: [{...userPrompt, id: uuidv4()}],
        metadata: {settings: settings ?? {}},
    }).returning();

    return { ...result[0], assets: [] };
}

type UpdateAssetRequestPayload = {
    status?: AgentRunStatus;
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

const DEFAULT_MESSAGES_PAGE_SIZE = 20;
const MAX_MESSAGES_PAGE_SIZE = 50;

type AssetRequestRunWithAssets = typeof assetsAgentRuns.$inferSelect & {
    assets: typeof assets.$inferSelect[];
}

type ListAssetRequestAssetsResult = {
    data: AssetRequestRunWithAssets[];
    nextCursor: string | null;
    hasMore: boolean;
}

export const listAssetRequestAssets = async (
    projectId: string,
    options?: CursorPaginationOptions
  ): Promise<ListAssetRequestAssetsResult> => {
    const limit = Math.min(options?.limit ?? DEFAULT_MESSAGES_PAGE_SIZE, MAX_MESSAGES_PAGE_SIZE);
    const cursor = options?.cursor;
  
    const rows = await db.query.assetsAgentRuns.findMany({
      where: cursor
        ? and(
            eq(assetsAgentRuns.projectId, projectId),
            lt(assetsAgentRuns.createdAt, new Date(cursor))
          )
        : eq(assetsAgentRuns.projectId, projectId),
      orderBy: desc(assetsAgentRuns.createdAt),
      limit: limit + 1,
      with: {
        assets: true,
      },
    });
  
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit).reverse();
    const nextCursor =
      hasMore && page.length > 0 ? String(page[0].createdAt.toISOString()) : null;
  
    return { data: page, nextCursor, hasMore };
  }

export const getAssetFolder = async (projectId: string) => {
    const rootResponse = await db.select().from(fileNodes)
                                    .where(and(
                                        eq(fileNodes.projectId, projectId), 
                                        isNull(fileNodes.parentId),
                                        eq(fileNodes.directory, true),
                                        eq(fileNodes.name, 'root')
                                    ));
    const rootFolder = rootResponse[0];
    if(!rootFolder){
        return {
            assetsFolder: null,
            uploadsFolder: null,
        };
    }
    const result = await db.select().from(fileNodes)
                                    .where(and(
                                        eq(fileNodes.projectId, projectId), 
                                        eq(fileNodes.parentId, rootFolder.id),
                                        eq(fileNodes.directory, true),
                                        eq(fileNodes.name, 'assets')
                                    ));
    const assetsFolder = result[0];
    if(!assetsFolder){
        return {
            assetsFolder: null,
            uploadsFolder: null,
        };
    }
    const uploadsFolder = await db.select().from(fileNodes)
                                    .where(and(
                                        eq(fileNodes.projectId, projectId), 
                                        eq(fileNodes.parentId, assetsFolder.id),
                                        eq(fileNodes.directory, true),
                                        eq(fileNodes.name, 'uploads')
                                    ));
    return {
        assetsFolder: result[0],
        uploadsFolder: uploadsFolder[0],
    };
}

export const getAssetById = async (projectId: string, assetId: string) => {
    const result = await db.select().from(assets).where(and(eq(assets.projectId, projectId), eq(assets.id, assetId)));
    return result[0];
}

export const getAssetsByIds = async (projectId: string, assetIds: string[]) => {
    if (assetIds.length === 0) {
        return [];
    }

    return await db.select()
        .from(assets)
        .where(and(
            eq(assets.projectId, projectId),
            inArray(assets.id, assetIds),
        ));
}

export const deleteAsset = async (assetId: string) => {
    const result = await db.delete(assets).where(eq(assets.id, assetId));
    return (result.rowCount ?? 0) > 0;
}

export const deleteAssets = async (projectId: string, assetIds: string[]) => {
    if (assetIds.length === 0) {
        return 0;
    }

    const result = await db.delete(assets)
        .where(and(
            eq(assets.projectId, projectId),
            inArray(assets.id, assetIds),
        ));

    return result.rowCount ?? 0;
}

type AttachAssetToFileNodePayload = {
    projectId: string;
    assetId: string;
    folderId: string;
}

type AttachAssetsToFileNodesPayload = {
    projectId: string;
    assetIds: string[];
    folderId: string;
}

export const attachAssetToFileNode = async ({projectId, assetId, folderId}: AttachAssetToFileNodePayload) => {
    return await db.transaction(async (tx) => {
        const res1 = await tx.select().from(assets).where(and(eq(assets.projectId, projectId), eq(assets.id, assetId)));
        const asset = res1[0];
        if(!asset){
            throw new Error('Asset not found');
        }
        const resPos = await tx.select({
            maxPosition: max(fileNodes.position),
        }).from(fileNodes)
          .where(and(eq(fileNodes.projectId, projectId), eq(fileNodes.parentId, folderId)));
        const maxPosition = resPos[0]?.maxPosition ?? 0;
        const res2 = await tx.insert(fileNodes).values({
            projectId,
            name: asset.name,
            parentId: folderId,
            format: asset.type,
            editable: true,
            position: maxPosition + ORDER_GAP
        }).returning();
        const fileNode = res2[0];
        if(!fileNode){
            throw new Error('Failed to create file node');
        }
        
        await tx.update(assets).set({ fileNodeId: fileNode.id }).where(eq(assets.id, assetId));

        return { asset, fileNode };
    });
}

export const attachAssetsToFileNodes = async ({projectId, assetIds, folderId}: AttachAssetsToFileNodesPayload) => {
    if (assetIds.length === 0) {
        return { assets: [], fileNodes: [] };
    }

    return await db.transaction(async (tx) => {
        const selectedAssets = await tx.select()
            .from(assets)
            .where(and(
                eq(assets.projectId, projectId),
                inArray(assets.id, assetIds),
            ));

        const assetsById = new Map(selectedAssets.map((asset) => [asset.id, asset]));
        const orderedAssets = assetIds.flatMap((assetId) => {
            const asset = assetsById.get(assetId);
            return asset ? [asset] : [];
        });

        const resPos = await tx.select({
            maxPosition: max(fileNodes.position),
        }).from(fileNodes)
          .where(and(eq(fileNodes.projectId, projectId), eq(fileNodes.parentId, folderId)));
        const maxPosition = resPos[0]?.maxPosition ?? 0;

        const fileNodeRows = orderedAssets.map((asset, index) => ({
            projectId,
            name: asset.name,
            parentId: folderId,
            format: asset.type,
            editable: true,
            position: maxPosition + ORDER_GAP * (index + 1),
        }));

        const insertedFileNodes = await tx.insert(fileNodes).values(fileNodeRows).returning();
        if (insertedFileNodes.length !== orderedAssets.length) {
            throw new Error('Failed to create all file nodes');
        }

        for (const [index, asset] of orderedAssets.entries()) {
            const fileNode = insertedFileNodes[index];
            if (!fileNode) {
                throw new Error('Failed to create file node');
            }

            await tx.update(assets)
                .set({ fileNodeId: fileNode.id })
                .where(and(
                    eq(assets.projectId, projectId),
                    eq(assets.id, asset.id),
                ));
        }

        return { assets: orderedAssets, fileNodes: insertedFileNodes };
    });
}