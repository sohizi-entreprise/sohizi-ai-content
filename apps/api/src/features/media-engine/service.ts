import { captureConsentedEvent } from "@/features/analytics-consent"
import * as repo from "./repo"
import * as storage from "./storage"
import type { GetUploadUrlInput, uploadSuccessSchema } from "./schema"
import { BadRequest, Conflict, Forbidden, NotFound } from "../error"
import { getProjectById } from "../project/repo"
import z from "zod"
import {
  getFileNodeById,
  listDirectoryFiles,
  ORDER_GAP,
  FileNodeUniqueConstraintError,
} from "../file-system/repo"
import { normalizeFileNodeName, serializeFileNode } from "../file-system/utils"
import { AssetType, CursorPaginationOptions } from "@/type"
import { broadcastCancellation } from "../generation-request/abort-manager"
import { v4 as uuidv4 } from "uuid"
import {
  decrementKey,
  incrementKey,
  markStreamActive,
  removeStreamActive,
  streamChunksAsSse,
} from "../generation-request/stream-handler"
import { getErrorMessage } from "@/utils/get-error-message"
import { ZipArchive } from "archiver"
import { PassThrough, Readable } from "node:stream"
import { inngest } from "@/lib/inngest/client"
import { estimateCatalogMediaCredits } from "./catalog-cost"
import {
  acquireUserSlot,
  releaseUserSlot,
  userLimitToHttp,
  UserConcurrencyLimitError,
} from "@/features/capacity/user-gate"
import { releaseCapacityLease } from "@/features/capacity/router"
import { resolveAccount } from "@/features/capacity/registry"
import { createProvider } from "./providers/factory"
import { getGenerationRequest } from "../generation-request/repo"
import { billingService, safeRefund } from "@/features/billing"

export async function getUploadUrl(projectId: string, data: GetUploadUrlInput) {
  const project = await getProjectById(projectId)
  if (!project) {
    throw new NotFound("Project not found")
  }

  if (data.contentLength > storage.getMaxUploadSizeInBytes(data.contentType)) {
    throw new BadRequest("File exceeds the maximum allowed size")
  }

  try {
    const { url, storageKey } = await storage.generateSignedUploadUrl(
      data.fileName,
      data.contentType,
      data.contentLength,
    )

    // Check if the file already exists
    const fileExists = await storage.fileExists(storageKey)
    if (fileExists) {
      throw new BadRequest("File already exists")
    }

    return { url, storageKey }
  } catch (error) {
    if (error instanceof BadRequest || error instanceof NotFound) throw error
    console.error(error)
    throw new BadRequest("Failed to generate signed upload url")
  }
}

export async function getDownloadUrl(projectId: string, assetId: string) {
  const asset = await repo.getAssetById(projectId, assetId)
  if (!asset) {
    throw new NotFound("Asset not found")
  }

  try {
    return await storage.generateSignedDownloadUrl(asset.storageKey, asset.name)
  } catch (error) {
    console.error(error)
    throw new BadRequest("Failed to generate signed download url")
  }
}

export async function uploadSuccess(
  projectId: string,
  data: z.infer<typeof uploadSuccessSchema>,
) {
  const { folderId, storageKey } = data
  const project = await getProjectById(projectId)
  if (!project) {
    throw new NotFound("Project not found")
  }

  const fileExists = await storage.fileExists(storageKey)
  if (!fileExists) {
    throw new NotFound("File not found")
  }

  const fileMetadata = await storage.getFileMetadata(data.storageKey)
  if (
    fileMetadata.size >
    storage.getMaxUploadSizeInBytes(fileMetadata.contentType)
  ) {
    await storage.deleteFile(storageKey)
    throw new BadRequest("Uploaded file exceeds the maximum allowed size")
  }

  const fileName = getFileName(storageKey)

  if (!folderId) {
    const asset = await repo.createAsset({
      projectId,
      name: fileName,
      type: storage.classifyContentType(fileMetadata.contentType).assetType,
      url: storage.buildPublicUrl(storageKey),
      source: "user-uploaded",
      metadata: fileMetadata,
      storageKey,
    })
    return { asset, fileNode: null }
  }

  const folder = await getFileNodeById(projectId, folderId)
  if (!folder || !folder.directory) {
    throw new BadRequest("Required a folder to upload the file to")
  }
  const uploadfolderId = folder.id

  const siblingsFiles = await listDirectoryFiles(projectId, uploadfolderId)
  const fileNodeName = normalizeFileNodeName(fileName, false)
  if (!fileNodeName) throw new BadRequest("Invalid file name")
  if (siblingsFiles.some((file) => file.name === fileNodeName)) {
    await storage.deleteFile(storageKey)
    throw new Conflict("File name already exists in that parent directory.")
  }
  if (siblingsFiles.length >= 100) {
    throw new BadRequest("Maximum number of files reached in the folder")
  }

  // save the asset to the database
  try {
    const lastPosition = siblingsFiles[siblingsFiles.length - 1]?.position ?? 0
    const filePosition = lastPosition + ORDER_GAP
    const response = await repo.createAssetWithFileNode({
      projectId,
      name: fileName,
      type: storage.classifyContentType(fileMetadata.contentType).assetType,
      url: storage.buildPublicUrl(storageKey),
      source: "user-uploaded",
      folderId: uploadfolderId,
      metadata: fileMetadata,
      storageKey,
      filePosition,
    })
    return {
      ...response,
      fileNode: serializeFileNode(response.fileNode),
    }
  } catch (error) {
    if (error instanceof FileNodeUniqueConstraintError) {
      await storage.deleteFile(storageKey)
      throw new Conflict(error.message)
    }
    console.error(error)
    throw new BadRequest("Failed to create asset with file node")
  }
}

export const assetRequestSchema = z.object({
  model: z.string(),
  settings: z.record(z.string(), z.any()),
  context: z.record(z.string(), z.any()),
})

export type RunAgentPayload = {
  userId: string
  projectId: string
  organizationId: string
  analyticsConsentId?: string | null
} & z.infer<typeof assetRequestSchema>

export const estimateGenerationCredits = async (
  payload: z.infer<typeof assetRequestSchema>,
) => {
  if (!payload.model) {
    return { credits: null }
  }

  try {
    const credits = await estimateCatalogMediaCredits(
      payload.model,
      payload.settings,
      toProviderMediaType(payload.context),
    )
    return { credits }
  } catch (error) {
    console.error(error)
    return { credits: null }
  }
}

export const generateAsset = async (payload: RunAgentPayload) => {
  const requestPayload = {
    model: payload.model,
    settings: payload.settings,
    context: payload.context,
  }
  const requestId = uuidv4()
  const mediaType = toProviderMediaType(payload.context)
  const leaseTtlMs = mediaType === "video" ? 60 * 60 * 1000 : 30 * 60 * 1000
  let userLease = null as Awaited<ReturnType<typeof acquireUserSlot>>
  try {
    userLease = await acquireUserSlot({
      userId: payload.userId,
      holderId: requestId,
      task: "media",
      leaseTtlMs,
    })
  } catch (error) {
    if (error instanceof UserConcurrencyLimitError) throw userLimitToHttp(error)
    throw error
  }

  let created = false
  try {
    const run = await repo.createAssetRequest(
      payload.projectId,
      payload.userId,
      requestPayload,
      payload.analyticsConsentId,
      requestId,
      userLease,
    )
    created = true
    await markStreamActive(run.id)
    await incrementKey(run.id)
    await inngest.send({
      name: "media/generate",
      data: {
        requestId: run.id,
        projectId: payload.projectId,
        organizationId: payload.organizationId,
        userId: payload.userId,
        model: payload.model,
        payload: payload.settings,
        referenceFiles: payload.context.referenceFiles || [],
        mediaType,
        _reservationId: uuidv4(),
        analyticsConsentId: payload.analyticsConsentId,
      },
    })
    await repo.markGenerationEnqueued(run.id)
    await captureConsentedEvent(
      payload.analyticsConsentId,
      payload.userId,
      "generation_started",
      {
        project_id: payload.projectId,
        request_id: run.id,
        media_type: mediaType,
      },
    )
    return run
  } catch (error) {
    await releaseUserSlot(userLease).catch((releaseError) => {
      console.error("[media] failed to release user slot", releaseError)
    })
    if (created) {
      await repo.updateAssetRequest(requestId, {
        status: "failed",
        error: getErrorMessage(error, "Completion failed"),
      })
      const remaining = await decrementKey(requestId)
      if (remaining === 0) await removeStreamActive(requestId)
    }
    throw error
  }
}

export const cancelGeneration = async (
  projectId: string,
  requestId: string,
  actorUserId: string,
) => {
  const request = await getGenerationRequest(requestId)
  if (!request || request.projectId !== projectId) {
    throw new NotFound("Generation request not found")
  }
  if (request.userId !== actorUserId) {
    throw new Forbidden("You cannot cancel this generation")
  }
  await broadcastCancellation(requestId)
  await repo.requestMediaCancellation(requestId)
  await repo.updateAssetRequest(requestId, { status: "aborted" })
  await removeStreamActive(requestId)

  let providerStopped = !request.providerRequestId
  if (
    request.providerRequestId &&
    request.capacityAccountId &&
    request.submitState !== "submission_unknown"
  ) {
    const account = resolveAccount(request.capacityAccountId)
    if (account) {
      try {
        const provider = createProvider(account.adapter, account.credential)
        const cancelled = await provider.cancelRequest(
          request.providerRequestId,
        )
        providerStopped = cancelled.ok
      } catch (error) {
        console.error("[media] provider cancel failed", requestId, error)
        providerStopped = false
      }
    }
  }

  await releaseUserSlot(request.userLease)
  if (request.capacityLease && providerStopped) {
    await releaseCapacityLease(request.capacityLease, "completed", {
      burst: 0,
    })
  }
  if (request.billingReservationId) {
    await safeRefund(
      billingService,
      request.billingReservationId,
      "media-cancelled",
    )
  }
  return { ok: true, error: null }
}

export const deleteGenerationRequest = async (
  projectId: string,
  requestId: string,
) => {
  const deleted = await repo.deleteAssetRequest(projectId, requestId)
  if (!deleted) {
    throw new NotFound("Generation request not found")
  }
  return { ok: true }
}

export const listAssets = async (
  projectId: string,
  options?: CursorPaginationOptions,
) => {
  return await repo.listAssetRequestAssets(projectId, options)
}

export const listAiGeneratedAssets = async (
  projectId: string,
  options?: CursorPaginationOptions & { type?: AssetType },
) => {
  return await repo.listAiGeneratedAssets(projectId, options)
}

export const listUploadedAssets = async (
  projectId: string,
  options?: CursorPaginationOptions & { type?: AssetType },
) => {
  return await repo.listUploadedAssets(projectId, options)
}

export async function* getRequestStreams(requestId: string) {
  yield* streamChunksAsSse(requestId)
}

export const deleteAsset = async (assetId: string) => {
  return await repo.deleteAsset(assetId)
}

export const updateHtmlAssetValues = async (
  projectId: string,
  assetId: string,
  values: Record<string, string | number | boolean>,
) => {
  const asset = await repo.getAssetById(projectId, assetId)
  if (!asset) {
    throw new NotFound("Asset not found")
  }
  if (asset.type !== "html") {
    throw new BadRequest("Only HTML assets support composition values")
  }

  const updated = await repo.updateAssetMetadataValues(
    projectId,
    assetId,
    values,
  )
  if (!updated) {
    throw new NotFound("Asset not found")
  }

  return updated
}

export const attachAssetToFileNode = async (
  projectId: string,
  assetId: string,
  folderId: string,
) => {
  const asset = await repo.getAssetById(projectId, assetId)
  if (!asset || asset.fileNodeId) {
    throw new Forbidden(
      "Asset does not exist or already attached to a file node",
    )
  }
  const folder = await getFileNodeById(projectId, folderId)
  if (!folder || !folder.directory) {
    throw new Forbidden("Folder does not exist or is not a directory")
  }

  const result = await repo
    .attachAssetToFileNode({
      projectId,
      assetId,
      folderId,
    })
    .catch((error: unknown) => {
      if (error instanceof FileNodeUniqueConstraintError)
        throw new Conflict(error.message)
      throw error
    })
  return {
    ...result,
    fileNode: serializeFileNode(result.fileNode),
  }
}

export const deleteAssets = async (projectId: string, assetIds: string[]) => {
  const normalizedAssetIds = normalizeAssetIds(assetIds)
  await getAssetsForBulkAction(projectId, normalizedAssetIds)
  const deletedCount = await repo.deleteAssets(projectId, normalizedAssetIds)

  return { ok: deletedCount === normalizedAssetIds.length, count: deletedCount }
}

export const attachAssetsToFileNodes = async (
  projectId: string,
  assetIds: string[],
  folderId: string,
) => {
  const normalizedAssetIds = normalizeAssetIds(assetIds)
  const selectedAssets = await getAssetsForBulkAction(
    projectId,
    normalizedAssetIds,
  )
  const attachedAsset = selectedAssets.find((asset) => asset.fileNodeId)
  if (attachedAsset) {
    throw new Forbidden(
      "One or more assets are already attached to a file node",
    )
  }

  const folder = await getFileNodeById(projectId, folderId)
  if (!folder || !folder.directory) {
    throw new Forbidden("Folder does not exist or is not a directory")
  }

  const result = await repo
    .attachAssetsToFileNodes({
      projectId,
      assetIds: normalizedAssetIds,
      folderId,
    })
    .catch((error: unknown) => {
      if (error instanceof FileNodeUniqueConstraintError)
        throw new Conflict(error.message)
      throw error
    })
  return {
    ...result,
    fileNodes: result.fileNodes.map(serializeFileNode),
  }
}

export const downloadAssetsZip = async (
  projectId: string,
  assetIds: string[],
) => {
  const normalizedAssetIds = normalizeAssetIds(assetIds)
  const selectedAssets = await getAssetsForBulkAction(
    projectId,
    normalizedAssetIds,
  )
  const assetsById = new Map(selectedAssets.map((asset) => [asset.id, asset]))
  const orderedAssets = normalizedAssetIds.flatMap((assetId) => {
    const asset = assetsById.get(assetId)
    return asset ? [asset] : []
  })

  const archive = new ZipArchive({ zlib: { level: 9 } })
  const output = new PassThrough()
  archive.on("error", (error: Error) => output.destroy(error))
  archive.pipe(output)

  void (async () => {
    try {
      const usedNames = new Map<string, number>()
      for (const asset of orderedAssets) {
        const buffer = await storage.readFileBuffer(asset.storageKey)
        archive.append(buffer, {
          name: buildZipEntryName(asset.name, usedNames),
        })
      }
      await archive.finalize()
    } catch (error) {
      output.destroy(
        error instanceof Error ? error : new Error("Failed to build zip file"),
      )
    }
  })()

  return new Response(Readable.toWeb(output) as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="generated-assets.zip"`,
    },
  })
}

function getFileName(storageKey: string): string {
  const name = storageKey.split("/").pop() || "new-asset-file"
  return name
}

function normalizeAssetIds(assetIds: string[]) {
  return [...new Set(assetIds)]
}

async function getAssetsForBulkAction(projectId: string, assetIds: string[]) {
  if (assetIds.length === 0) {
    throw new BadRequest("At least one asset is required")
  }

  const selectedAssets = await repo.getAssetsByIds(projectId, assetIds)
  if (selectedAssets.length !== assetIds.length) {
    throw new NotFound("One or more assets were not found")
  }

  return selectedAssets
}

function buildZipEntryName(fileName: string, usedNames: Map<string, number>) {
  const sanitizedName = storage.sanitizeFileName(fileName) || "asset"
  const currentCount = usedNames.get(sanitizedName) ?? 0
  usedNames.set(sanitizedName, currentCount + 1)

  if (currentCount === 0) {
    return sanitizedName
  }

  const extensionIndex = sanitizedName.lastIndexOf(".")
  if (extensionIndex <= 0) {
    return `${sanitizedName}-${currentCount + 1}`
  }

  return `${sanitizedName.slice(0, extensionIndex)}-${currentCount + 1}${sanitizedName.slice(extensionIndex)}`
}

function toProviderMediaType(
  context: Record<string, unknown>,
): "image" | "video" | "audio" {
  const mediaType = context.mediaType ?? context.generationType
  if (mediaType === "video") return "video"
  if (
    mediaType === "audio" ||
    mediaType === "music" ||
    mediaType === "dialogue"
  )
    return "audio"
  return "image"
}
