import { db } from "@/db"
import {
  assets,
  fileNodes,
  generationRequests,
  llmVendorsAndParameters,
  llmVendorModelParameterOverrides,
  modelParameters,
  llmVendors,
  parameterOptions,
  llmVendorsAndParameterOptions,
  modelsAndParameterOptions,
  modelsAndParameters,
  llmModels,
  modelsAndCategories,
  modelCategories,
} from "@/db/schema"
import type {
  AssetType,
  AssetSource,
  AssetMetadata,
  CursorPaginationOptions,
  CursorPaginationResult,
  GenerationRequestStatus,
} from "@/type"
import { and, eq, desc, lt, isNull, max, inArray, or, sql } from "drizzle-orm"
import { ORDER_GAP } from "../file-system/repo"
import { FileNodeUniqueConstraintError } from "../file-system/repo"
import { expireAssets } from "./asset-retention"
import { classifyFileKindFromAsset } from "../file-system/file-kind"
import { joinLtree, normalizeFileNodeName } from "../file-system/utils"
import { DatabaseError } from "pg"
import { mergeAssetFileNodeMetadata } from "./file-node-metadata"
import {
  createGenerationRequest,
  deleteGenerationRequest,
  updateGenerationRequest,
} from "../generation-request/repo"

type CreateAssetPayload = {
  projectId: string
  name: string
  type: AssetType
  url: string
  storageKey: string
  source: AssetSource
  metadata: AssetMetadata
  generationRequestId?: string
}

type CreateAssetWithFileNodePayload = {
  projectId: string
  name: string
  type: AssetType
  url: string
  source: AssetSource
  folderId: string
  storageKey: string
  metadata: AssetMetadata
  filePosition: number
}

function isFileNodeNameConflict(error: unknown): boolean {
  const cause = error instanceof Error && "cause" in error ? error.cause : null
  const databaseError = error instanceof DatabaseError ? error : cause
  return (
    databaseError instanceof DatabaseError &&
    databaseError.code === "23505" &&
    [
      "file_nodes_project_id_parent_id_name_unique",
      "file_nodes_project_id_path_unique",
    ].includes(databaseError.constraint ?? "")
  )
}

function rethrowFileNodeNameConflict(error: unknown): never {
  if (isFileNodeNameConflict(error)) {
    throw new FileNodeUniqueConstraintError(
      "File name already exists in that parent directory.",
    )
  }
  throw error
}

export const createAsset = async (payload: CreateAssetPayload) => {
  const result = await db.insert(assets).values(payload).returning()
  return result[0]
}

export const listUploadedAssets = async (
  projectId: string,
  options?: { type?: AssetType; cursor?: string; limit?: number },
): Promise<CursorPaginationResult<typeof assets.$inferSelect>> => {
  const { type, cursor, limit = 20 } = options ?? {}
  const pageSize = Math.max(limit, 1)

  const conditions = [
    eq(assets.projectId, projectId),
    eq(assets.source, "user-uploaded"),
    isNull(assets.expireAt),
  ]
  if (type) conditions.push(eq(assets.type, type))
  if (cursor) conditions.push(lt(assets.createdAt, new Date(cursor)))

  const rows = await db
    .select()
    .from(assets)
    .where(and(...conditions))
    .orderBy(desc(assets.createdAt))
    .limit(pageSize + 1)

  const hasMore = rows.length > pageSize
  const data = rows.slice(0, pageSize)
  const nextCursor =
    hasMore && data.length > 0
      ? data[data.length - 1].createdAt.toISOString()
      : null

  return { data, nextCursor, hasMore }
}

export const createAssetWithFileNode = async (
  payload: CreateAssetWithFileNodePayload,
) => {
  const {
    projectId,
    name,
    type,
    url,
    source,
    folderId,
    metadata,
    storageKey,
    filePosition,
  } = payload
  const normalizedName = normalizeFileNodeName(name, false)
  if (!normalizedName) throw new Error("Invalid file name")

  const result = await db.transaction(async (tx) => {
    const existingFileNodeResponse = await tx
      .select()
      .from(fileNodes)
      .where(
        and(
          eq(fileNodes.projectId, projectId),
          eq(fileNodes.parentId, folderId),
          eq(fileNodes.name, normalizedName),
        ),
      )
      .limit(1)
    const existingFileNode = existingFileNodeResponse[0]

    if (existingFileNode) {
      throw new FileNodeUniqueConstraintError(
        "File name already exists in that parent directory.",
      )
    }

    const folderResponse = await tx
      .select({ path: fileNodes.path })
      .from(fileNodes)
      .where(
        and(eq(fileNodes.projectId, projectId), eq(fileNodes.id, folderId)),
      )
    const folder = folderResponse[0]
    if (!folder) {
      throw new Error("Folder not found")
    }

    const kind = classifyFileKindFromAsset(type, metadata.contentType)
    const filePayload = {
      projectId,
      name: normalizedName,
      parentId: folderId,
      type: kind.type,
      format: kind.format,
      editable: true,
      position: filePosition,
      path: joinLtree(folder.path, normalizedName),
      metadata: mergeAssetFileNodeMetadata(null, {
        metadata,
        url,
        storageKey,
      }),
    }
    const fileNodeResponse = await tx
      .insert(fileNodes)
      .values(filePayload)
      .returning()
      .execute()
      .catch(rethrowFileNodeNameConflict)
    const fileNode = fileNodeResponse[0]
    if (!fileNode) {
      throw new Error("Failed to create file node")
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
    const assetResponse = await tx
      .insert(assets)
      .values(assetPayload)
      .returning()
    const asset = assetResponse[0]
    if (!asset) {
      throw new Error("Failed to create asset")
    }
    return { asset, fileNode }
  })
  return result
}

export const getAssetByFileNodeId = async (
  projectId: string,
  fileNodeId: string,
) => {
  const result = await db
    .select()
    .from(assets)
    .where(
      and(
        eq(assets.projectId, projectId),
        eq(assets.fileNodeId, fileNodeId),
        isNull(assets.expireAt),
      ),
    )
  return result[0]
}

type AiGeneratedRequestAsset = {
  id: string
  name: string
  url: string
  type: AssetType
  metadata: AssetMetadata | null
  storageKey: string
}

type AiGeneratedMediaRequest = {
  id: string
  projectId: string
  status: GenerationRequestStatus
  request: Record<string, unknown> | null
  error: string | null
  createdAt: Date
  updatedAt: Date
  assets: AiGeneratedRequestAsset[]
}

type ListAiGeneratedAssetsOptions = CursorPaginationOptions & {
  type?: AssetType
}

const OPEN_GENERATION_STATUSES: GenerationRequestStatus[] = [
  "pending",
  "processing",
  "failed",
  "aborted",
]

export const listAiGeneratedAssets = async (
  projectId: string,
  options: ListAiGeneratedAssetsOptions = {},
): Promise<CursorPaginationResult<AiGeneratedMediaRequest>> => {
  const { cursor, limit = 50, type } = options
  const pageSize = Math.max(limit, 1)

  const conditions = [
    eq(generationRequests.projectId, projectId),
    eq(generationRequests.type, "media-generation"),
  ]
  if (cursor)
    conditions.push(lt(generationRequests.createdAt, new Date(cursor)))

  const joinConditions = [
    eq(assets.generationRequestId, generationRequests.id),
    isNull(assets.fileNodeId),
    isNull(assets.expireAt),
  ]
  if (type) joinConditions.push(eq(assets.type, type))

  const hasAssets = sql`count(${assets.id}) > 0`
  const openStatuses = inArray(
    generationRequests.status,
    OPEN_GENERATION_STATUSES,
  )
  const havingClause = type
    ? or(
        hasAssets,
        and(
          openStatuses,
          sql`${generationRequests.request}->'context'->>'mediaType' = ${type}`,
        ),
      )
    : or(hasAssets, openStatuses)

  const rows = await db
    .select({
      id: generationRequests.id,
      projectId: generationRequests.projectId,
      status: generationRequests.status,
      request: generationRequests.request,
      error: generationRequests.error,
      createdAt: generationRequests.createdAt,
      updatedAt: generationRequests.updatedAt,
      assets: sql<AiGeneratedRequestAsset[]>`
                coalesce(
                    jsonb_agg(
                        jsonb_build_object(
                            'id', ${assets.id},
                            'name', ${assets.name},
                            'url', ${assets.url},
                            'type', ${assets.type},
                            'metadata', ${assets.metadata},
                            'storageKey', ${assets.storageKey}
                        )
                    ) FILTER (WHERE ${assets.id} IS NOT NULL),
                    '[]'::jsonb
                )
            `,
    })
    .from(generationRequests)
    .leftJoin(assets, and(...joinConditions))
    .where(and(...conditions))
    .groupBy(generationRequests.id)
    .having(havingClause)
    .orderBy(desc(generationRequests.createdAt))
    .limit(pageSize + 1)

  const hasMore = rows.length > pageSize
  const data = rows.slice(0, pageSize).map((row) => ({
    ...row,
    assets: Array.isArray(row.assets) ? row.assets : [],
  }))
  const nextCursor =
    hasMore && data.length > 0
      ? data[data.length - 1].createdAt.toISOString()
      : null

  return { data, nextCursor, hasMore }
}

export const createAssetRequest = async (
  projectId: string,
  userId: string,
  requestPayload: Record<string, unknown>,
  analyticsConsentId?: string | null,
  id?: string,
  userLease?: {
    poolId: string
    holderId: string
    leaseId: string
    epoch: number
    expiresAtMs: number
  } | null,
) => {
  const result = await createGenerationRequest({
    id,
    projectId,
    userId,
    analyticsConsentId,
    type: "media-generation",
    request: requestPayload,
    userLease,
  })

  return { ...result, assets: result.assets ?? [] }
}

type UpdateAssetRequestPayload = {
  status?: GenerationRequestStatus
  history?: Record<string, unknown>[]
  error?: string
  request?: Record<string, unknown>
}

export const updateAssetRequest = async (
  runId: string,
  data: UpdateAssetRequestPayload,
) => {
  return updateGenerationRequest(runId, data)
}

export const patchRequestRouting = async (
  requestId: string,
  routing: { vendorName: string; apiName: string; providerRequestId: string },
) => {
  await db
    .update(generationRequests)
    .set({
      request: sql`coalesce(${generationRequests.request}, '{}'::jsonb) || ${JSON.stringify({ routing })}::jsonb`,
      providerRequestId: routing.providerRequestId,
      submitState: "submitted",
    })
    .where(eq(generationRequests.id, requestId))
}

type CapacityLeaseRecord = {
  poolId: string
  holderId: string
  leaseId: string
  epoch: number
  expiresAtMs: number
}

export const saveMediaSelection = async (
  requestId: string,
  selection: {
    accountId: string
    lease: CapacityLeaseRecord
    apiName: string
  },
) => {
  const updated = await db
    .update(generationRequests)
    .set({
      capacityAccountId: selection.accountId,
      capacityLease: selection.lease,
      submitState: "selected",
      request: sql`coalesce(${generationRequests.request}, '{}'::jsonb) || ${JSON.stringify({ routing: { apiName: selection.apiName, accountId: selection.accountId } })}::jsonb`,
    })
    .where(
      and(
        eq(generationRequests.id, requestId),
        isNull(generationRequests.providerRequestId),
      ),
    )
    .returning()
  return updated[0] ?? null
}

export const claimMediaSubmit = async (requestId: string) => {
  const updated = await db
    .update(generationRequests)
    .set({ submitState: "submitting" })
    .where(
      and(
        eq(generationRequests.id, requestId),
        eq(generationRequests.submitState, "selected"),
        isNull(generationRequests.providerRequestId),
      ),
    )
    .returning()
  return updated[0] ?? null
}

export const clearMediaSelection = async (requestId: string) => {
  await db
    .update(generationRequests)
    .set({
      capacityAccountId: null,
      capacityLease: null,
      submitState: null,
    })
    .where(
      and(
        eq(generationRequests.id, requestId),
        isNull(generationRequests.providerRequestId),
      ),
    )
}

export const markMediaSubmissionUnknown = async (requestId: string) => {
  await db
    .update(generationRequests)
    .set({ submitState: "submission_unknown" })
    .where(eq(generationRequests.id, requestId))
}

export const markGenerationEnqueued = async (requestId: string) => {
  await db
    .update(generationRequests)
    .set({ enqueuedAt: new Date(), status: "processing" })
    .where(eq(generationRequests.id, requestId))
}

export const setMediaBillingReservation = async (
  requestId: string,
  billingReservationId: string,
) => {
  await db
    .update(generationRequests)
    .set({ billingReservationId })
    .where(eq(generationRequests.id, requestId))
}

export const requestMediaCancellation = async (requestId: string) => {
  await db
    .update(generationRequests)
    .set({ cancelRequestedAt: new Date() })
    .where(eq(generationRequests.id, requestId))
}

export const deleteAssetRequest = async (
  projectId: string,
  requestId: string,
) => {
  return deleteGenerationRequest(projectId, requestId)
}

const DEFAULT_MESSAGES_PAGE_SIZE = 20
const MAX_MESSAGES_PAGE_SIZE = 50

type ListAssetRequestAssetsResult = {
  data: Array<typeof generationRequests.$inferSelect>
  nextCursor: string | null
  hasMore: boolean
}

export const listAssetRequestAssets = async (
  projectId: string,
  options?: CursorPaginationOptions,
): Promise<ListAssetRequestAssetsResult> => {
  const limit = Math.min(
    options?.limit ?? DEFAULT_MESSAGES_PAGE_SIZE,
    MAX_MESSAGES_PAGE_SIZE,
  )
  const cursor = options?.cursor

  const conditions = [
    eq(generationRequests.projectId, projectId),
    eq(generationRequests.type, "media-generation"),
  ]
  if (cursor) {
    conditions.push(lt(generationRequests.createdAt, new Date(cursor)))
  }

  const rows = await db
    .select()
    .from(generationRequests)
    .where(and(...conditions))
    .orderBy(desc(generationRequests.createdAt))
    .limit(limit + 1)

  const hasMore = rows.length > limit
  const page = rows
    .slice(0, limit)
    .reverse()
    .map((row) => ({
      ...row,
      assets: row.assets ?? [],
    }))
  const nextCursor =
    hasMore && page.length > 0 ? String(page[0].createdAt.toISOString()) : null

  return { data: page, nextCursor, hasMore }
}

export const getAssetFolder = async (projectId: string) => {
  const rootResponse = await db
    .select()
    .from(fileNodes)
    .where(
      and(
        eq(fileNodes.projectId, projectId),
        isNull(fileNodes.parentId),
        eq(fileNodes.directory, true),
        eq(fileNodes.name, "root"),
      ),
    )
  const rootFolder = rootResponse[0]
  if (!rootFolder) {
    return {
      assetsFolder: null,
    }
  }
  const result = await db
    .select()
    .from(fileNodes)
    .where(
      and(
        eq(fileNodes.projectId, projectId),
        eq(fileNodes.parentId, rootFolder.id),
        eq(fileNodes.directory, true),
        eq(fileNodes.name, "assets"),
      ),
    )
  return {
    assetsFolder: result[0] ?? null,
  }
}

export const getAssetById = async (projectId: string, assetId: string) => {
  const result = await db
    .select()
    .from(assets)
    .where(
      and(
        eq(assets.projectId, projectId),
        eq(assets.id, assetId),
        isNull(assets.expireAt),
      ),
    )
  return result[0]
}

export const updateAssetMetadataValues = async (
  projectId: string,
  assetId: string,
  values: Record<string, string | number | boolean>,
) => {
  const asset = await getAssetById(projectId, assetId)
  if (!asset) {
    return null
  }

  const existingMetadata = (asset.metadata ?? {}) as AssetMetadata
  const metadata: AssetMetadata = {
    ...existingMetadata,
    values,
  }

  return db.transaction(async (tx) => {
    const result = await tx
      .update(assets)
      .set({ metadata, updatedAt: new Date() })
      .where(
        and(
          eq(assets.projectId, projectId),
          eq(assets.id, assetId),
          isNull(assets.expireAt),
        ),
      )
      .returning()
    const updated = result[0]
    if (!updated) return null

    if (updated.fileNodeId) {
      await tx
        .update(fileNodes)
        .set({
          metadata: sql`coalesce(${fileNodes.metadata}, '{}'::jsonb) || ${JSON.stringify(
            mergeAssetFileNodeMetadata(null, updated),
          )}::jsonb`,
        })
        .where(
          and(
            eq(fileNodes.projectId, projectId),
            eq(fileNodes.id, updated.fileNodeId),
          ),
        )
    }
    return updated
  })
}

export const getAssetsByIds = async (projectId: string, assetIds: string[]) => {
  if (assetIds.length === 0) {
    return []
  }

  return await db
    .select()
    .from(assets)
    .where(
      and(
        eq(assets.projectId, projectId),
        inArray(assets.id, assetIds),
        isNull(assets.expireAt),
      ),
    )
}

export const deleteAsset = async (assetId: string) => {
  const expired = await expireAssets(eq(assets.id, assetId))
  return expired > 0
}

export const deleteAssets = async (projectId: string, assetIds: string[]) => {
  if (assetIds.length === 0) {
    return 0
  }

  const where = and(
    eq(assets.projectId, projectId),
    inArray(assets.id, assetIds),
  )
  if (!where) return 0
  return expireAssets(where)
}

type AttachAssetToFileNodePayload = {
  projectId: string
  assetId: string
  folderId: string
  fileName?: string
}

type AttachAssetsToFileNodesPayload = {
  projectId: string
  assetIds: string[]
  folderId: string
}

export const attachAssetToFileNode = async ({
  projectId,
  assetId,
  folderId,
  fileName: customFileName,
}: AttachAssetToFileNodePayload) => {
  return await db.transaction(async (tx) => {
    const res1 = await tx
      .select()
      .from(assets)
      .where(
        and(
          eq(assets.projectId, projectId),
          eq(assets.id, assetId),
          isNull(assets.expireAt),
        ),
      )
    const asset = res1[0]
    if (!asset) {
      throw new Error("Asset not found")
    }
    const resPos = await tx
      .select({
        maxPosition: max(fileNodes.position),
      })
      .from(fileNodes)
      .where(
        and(
          eq(fileNodes.projectId, projectId),
          eq(fileNodes.parentId, folderId),
        ),
      )
    const maxPosition = resPos[0]?.maxPosition ?? 0
    const folderResponse = await tx
      .select({ path: fileNodes.path })
      .from(fileNodes)
      .where(
        and(eq(fileNodes.projectId, projectId), eq(fileNodes.id, folderId)),
      )
    const folder = folderResponse[0]
    if (!folder) {
      throw new Error("Folder not found")
    }
    const rawName = customFileName?.trim() || asset.name
    const fileName = normalizeFileNodeName(rawName, false)
    if (!fileName) throw new Error("Invalid file name")
    const kind = classifyFileKindFromAsset(
      asset.type,
      asset.metadata?.contentType,
    )
    const res2 = await tx
      .insert(fileNodes)
      .values({
        projectId,
        name: fileName,
        parentId: folderId,
        type: kind.type,
        format: kind.format,
        editable: true,
        position: maxPosition + ORDER_GAP,
        path: joinLtree(folder.path, fileName),
        metadata: mergeAssetFileNodeMetadata(null, asset),
      })
      .returning()
      .execute()
      .catch(rethrowFileNodeNameConflict)
    const fileNode = res2[0]
    if (!fileNode) {
      throw new Error("Failed to create file node")
    }

    await tx
      .update(assets)
      .set({ fileNodeId: fileNode.id })
      .where(and(eq(assets.id, assetId), isNull(assets.expireAt)))

    return { asset, fileNode }
  })
}

export const attachAssetsToFileNodes = async ({
  projectId,
  assetIds,
  folderId,
}: AttachAssetsToFileNodesPayload) => {
  if (assetIds.length === 0) {
    return { assets: [], fileNodes: [] }
  }

  return await db.transaction(async (tx) => {
    const selectedAssets = await tx
      .select()
      .from(assets)
      .where(
        and(
          eq(assets.projectId, projectId),
          inArray(assets.id, assetIds),
          isNull(assets.expireAt),
        ),
      )

    const assetsById = new Map(selectedAssets.map((asset) => [asset.id, asset]))
    const orderedAssets = assetIds.flatMap((assetId) => {
      const asset = assetsById.get(assetId)
      return asset ? [asset] : []
    })

    const resPos = await tx
      .select({
        maxPosition: max(fileNodes.position),
      })
      .from(fileNodes)
      .where(
        and(
          eq(fileNodes.projectId, projectId),
          eq(fileNodes.parentId, folderId),
        ),
      )
    const maxPosition = resPos[0]?.maxPosition ?? 0
    const folderResponse = await tx
      .select({ path: fileNodes.path })
      .from(fileNodes)
      .where(
        and(eq(fileNodes.projectId, projectId), eq(fileNodes.id, folderId)),
      )
    const folder = folderResponse[0]
    if (!folder) {
      throw new Error("Folder not found")
    }

    const fileNodeRows = orderedAssets.map((asset, index) => {
      const fileName = normalizeFileNodeName(asset.name, false)
      if (!fileName) throw new Error("Invalid file name")
      const kind = classifyFileKindFromAsset(
        asset.type,
        asset.metadata?.contentType,
      )
      return {
        projectId,
        name: fileName,
        parentId: folderId,
        type: kind.type,
        format: kind.format,
        editable: true,
        position: maxPosition + ORDER_GAP * (index + 1),
        path: joinLtree(folder.path, fileName),
        metadata: mergeAssetFileNodeMetadata(null, asset),
      }
    })

    const insertedFileNodes = await tx
      .insert(fileNodes)
      .values(fileNodeRows)
      .returning()
      .execute()
      .catch(rethrowFileNodeNameConflict)
    if (insertedFileNodes.length !== orderedAssets.length) {
      throw new Error("Failed to create all file nodes")
    }

    for (const [index, asset] of orderedAssets.entries()) {
      const fileNode = insertedFileNodes[index]
      if (!fileNode) {
        throw new Error("Failed to create file node")
      }

      await tx
        .update(assets)
        .set({ fileNodeId: fileNode.id })
        .where(
          and(
            eq(assets.projectId, projectId),
            eq(assets.id, asset.id),
            isNull(assets.expireAt),
          ),
        )
    }

    return { assets: orderedAssets, fileNodes: insertedFileNodes }
  })
}

export const getVendorParamsMapping = async (
  vendor: string,
  modelId: string,
  params: string[],
) => {
  if (params.length === 0) {
    return []
  }

  return db
    .select({
      parameter: modelParameters.key,
      type: modelParameters.type,
      vendorParameter: sql<
        string | null
      >`coalesce(${llmVendorModelParameterOverrides.vendorParamName}, ${llmVendorsAndParameters.vendorParamName})`,
      optionValue: parameterOptions.value,
      vendorOption: llmVendorsAndParameterOptions.vendorOptionValue,
    })
    .from(modelsAndParameters)
    .innerJoin(
      modelParameters,
      eq(modelParameters.id, modelsAndParameters.parameterId),
    )
    .innerJoin(llmVendors, eq(llmVendors.name, vendor))
    .innerJoin(
      llmVendorsAndParameters,
      and(
        eq(llmVendorsAndParameters.vendorId, llmVendors.id),
        eq(
          llmVendorsAndParameters.parameterId,
          modelsAndParameters.parameterId,
        ),
      ),
    )
    .leftJoin(
      modelsAndParameterOptions,
      and(
        eq(modelsAndParameterOptions.modelId, modelsAndParameters.modelId),
        eq(
          modelsAndParameterOptions.parameterId,
          modelsAndParameters.parameterId,
        ),
      ),
    )
    .leftJoin(
      parameterOptions,
      and(
        eq(parameterOptions.id, modelsAndParameterOptions.optionId),
        eq(parameterOptions.parameterId, modelsAndParameterOptions.parameterId),
      ),
    )
    .leftJoin(
      llmVendorsAndParameterOptions,
      and(
        eq(
          llmVendorsAndParameterOptions.parameterOptionId,
          parameterOptions.id,
        ),
        eq(llmVendorsAndParameterOptions.vendorId, llmVendors.id),
      ),
    )
    .leftJoin(
      llmVendorModelParameterOverrides,
      and(
        eq(llmVendorModelParameterOverrides.vendorId, llmVendors.id),
        eq(
          llmVendorModelParameterOverrides.modelId,
          modelsAndParameters.modelId,
        ),
        eq(
          llmVendorModelParameterOverrides.parameterId,
          modelsAndParameters.parameterId,
        ),
      ),
    )
    .where(
      and(
        eq(modelsAndParameters.modelId, modelId),
        inArray(modelParameters.key, params),
      ),
    )
}

export const getModelSchema = async (modelId: string) => {
  const rows = await db
    .select({
      promptingTechnics: llmModels.promptingTechnics,
      key: modelParameters.key,
      type: modelParameters.type,
      description: modelParameters.description,
      constraints: modelsAndParameters.constraints,
      required: modelsAndParameters.required,
      optionValue: parameterOptions.value,
    })
    .from(llmModels)
    .leftJoin(
      modelsAndParameters,
      eq(modelsAndParameters.modelId, llmModels.id),
    )
    .leftJoin(
      modelParameters,
      eq(modelParameters.id, modelsAndParameters.parameterId),
    )
    .leftJoin(
      modelsAndParameterOptions,
      and(
        eq(modelsAndParameterOptions.modelId, modelsAndParameters.modelId),
        eq(
          modelsAndParameterOptions.parameterId,
          modelsAndParameters.parameterId,
        ),
      ),
    )
    .leftJoin(
      parameterOptions,
      and(
        eq(parameterOptions.id, modelsAndParameterOptions.optionId),
        eq(parameterOptions.parameterId, modelsAndParameterOptions.parameterId),
      ),
    )
    .where(eq(llmModels.id, modelId))

  const byKey = new Map<
    string,
    {
      key: string
      type: NonNullable<(typeof rows)[number]["type"]>
      description: string | null
      constraints: (typeof rows)[number]["constraints"]
      required: boolean
      options: string[]
    }
  >()

  for (const row of rows) {
    if (!row.key || !row.type || row.required == null) {
      continue
    }
    let parameter = byKey.get(row.key)
    if (!parameter) {
      parameter = {
        key: row.key,
        type: row.type,
        description: row.description,
        constraints: row.constraints,
        required: row.required,
        options: [],
      }
      byKey.set(row.key, parameter)
    }
    if (row.optionValue != null) {
      parameter.options.push(row.optionValue)
    }
  }

  return {
    promptingTechnics: rows[0]?.promptingTechnics ?? [],
    parameters: [...byKey.values()],
  }
}

export const listGenerationModels = async (type: string) => {
  const result = await db
    .select({
      id: llmModels.id,
      description: llmModels.description,
      selectionGuidance: llmModels.selectionGuidance,
      pricing: llmModels.pricing,
    })
    .from(llmModels)
    .innerJoin(
      modelsAndCategories,
      eq(modelsAndCategories.modelId, llmModels.id),
    )
    .innerJoin(
      modelCategories,
      eq(modelCategories.id, modelsAndCategories.categoryId),
    )
    .where(and(eq(modelCategories.name, type), eq(llmModels.enabled, true)))

  return result
}
