import { db } from "@/db"
import {
  assets,
  fileNodeContentChunks,
  fileNodeContents,
  fileNodes,
  pendingFileOperations,
  skills,
  videoCompositions,
  type FileNode,
} from "@/db/schema"
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm"
import { DatabaseError } from "pg"
import {
  FileCreationRequest,
  FileNodeInsertPosition,
  UpdateFileContentRequest,
  UpdateFileRequest,
  UpdateSkillRequest,
} from "./payload"
import { FileFormat } from "./constants"
import { FilePendingOperation } from "@/type"
import { joinLtree, toApiPath, ltreeDepth } from "./utils"

export const ORDER_GAP = 1000

const FILE_NODE_UNIQUE_CONSTRAINTS = new Set([
  "file_nodes_project_id_parent_id_name_unique",
  "file_nodes_project_id_root_name_unique",
  "file_nodes_project_id_path_unique",
])

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

const escapeLikePattern = (value: string) => {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`)
}

type DbExecutor = Pick<typeof db, "select" | "execute" | "update" | "insert">

export class FileNodeInsertionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "FileNodeInsertionError"
  }
}

export class FileNodeUniqueConstraintError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "FileNodeUniqueConstraintError"
  }
}

const isFileNodeUniqueConstraintError = (error: unknown) => {
  return (
    error instanceof DatabaseError &&
    error.code === "23505" &&
    !!error.constraint &&
    FILE_NODE_UNIQUE_CONSTRAINTS.has(error.constraint)
  )
}

async function resolveChildPath(
  executor: DbExecutor,
  projectId: string,
  parentId: string | null,
  name: string,
) {
  if (!parentId) {
    return joinLtree(null, name)
  }

  const parent = await executor
    .select({ path: fileNodes.path })
    .from(fileNodes)
    .where(and(eq(fileNodes.projectId, projectId), eq(fileNodes.id, parentId)))
  const parentPath = parent[0]?.path
  if (!parentPath) {
    throw new FileNodeInsertionError("Invalid parent directory")
  }
  return joinLtree(parentPath, name)
}

async function rewriteSubtreePaths(
  executor: DbExecutor,
  projectId: string,
  oldPath: string,
  newPath: string,
) {
  if (oldPath === newPath) {
    return
  }

  await executor.execute(sql`
    UPDATE file_nodes
    SET path = ${newPath}::ltree || subpath(path, nlevel(${oldPath}::ltree))
    WHERE project_id = ${projectId}
      AND path <@ ${oldPath}::ltree
  `)
}

// ================================

export async function getFileNodeById(
  projectId: string,
  id: string,
): Promise<FileNode | undefined>
export async function getFileNodeById(
  projectId: string,
  id: string[],
): Promise<FileNode[]>
export async function getFileNodeById(
  projectId: string,
  id: string | string[],
): Promise<FileNode | undefined | FileNode[]> {
  if (Array.isArray(id)) {
    if (id.length === 0) {
      return []
    }

    const result = await db
      .select()
      .from(fileNodes)
      .where(
        and(
          eq(fileNodes.projectId, projectId),
          sql`${fileNodes.id} = ANY(${id})`,
        ),
      )

    const fileNodesById = new Map(
      result.map((fileNode) => [fileNode.id, fileNode]),
    )
    return id.flatMap((fileNodeId) => {
      const fileNode = fileNodesById.get(fileNodeId)
      return fileNode ? [fileNode] : []
    })
  }

  const result = await db
    .select()
    .from(fileNodes)
    .where(and(eq(fileNodes.id, id), eq(fileNodes.projectId, projectId)))
  return result[0]
}

export const getFileNodeByName = async (
  projectId: string,
  parentId: string | null,
  name: string,
) => {
  const result = await db
    .select()
    .from(fileNodes)
    .where(
      and(
        eq(fileNodes.projectId, projectId),
        eq(fileNodes.name, name),
        parentId === null
          ? isNull(fileNodes.parentId)
          : eq(fileNodes.parentId, parentId),
      ),
    )
  return result[0]
}

export const getFileNodeByPath = async (
  projectId: string,
  ltreePath: string,
) => {
  const result = await db
    .select()
    .from(fileNodes)
    .where(
      and(eq(fileNodes.projectId, projectId), eq(fileNodes.path, ltreePath)),
    )
  return result[0]
}

type SearchFileNodesByNameOptions = {
  directory?: boolean
  format?: FileFormat
}

export const searchFileNodesByName = async (
  projectId: string,
  name: string,
  limit = 15,
  options?: SearchFileNodesByNameOptions,
): Promise<FileNode[]> => {
  const normalizedName = name.trim()

  if (!normalizedName) {
    return []
  }

  const escapedName = escapeLikePattern(normalizedName)
  const containsPattern = `%${escapedName}%`
  const prefixPattern = `${escapedName}%`
  const exactName = normalizedName.toLowerCase()

  return db
    .select()
    .from(fileNodes)
    .where(
      and(
        eq(fileNodes.projectId, projectId),
        sql`${fileNodes.name} ILIKE ${containsPattern} ESCAPE '\\'`,
        options?.directory === undefined
          ? undefined
          : eq(fileNodes.directory, options.directory),
        options?.format === undefined
          ? undefined
          : eq(fileNodes.format, options.format),
      ),
    )
    .orderBy(
      sql`CASE
                    WHEN lower(${fileNodes.name}) = ${exactName} THEN 0
                    WHEN ${fileNodes.name} ILIKE ${prefixPattern} ESCAPE '\\' THEN 1
                    ELSE 2
                END`,
      sql`similarity(${fileNodes.name}, ${normalizedName}) DESC`,
      sql`length(${fileNodes.name})`,
      asc(fileNodes.name),
    )
    .limit(limit)
}

export const searchFileNodesByFormat = async (
  projectId: string,
  format: FileFormat,
  limit = 15,
): Promise<FileNode[]> => {
  return db
    .select()
    .from(fileNodes)
    .where(
      and(eq(fileNodes.projectId, projectId), eq(fileNodes.format, format)),
    )
    .limit(limit)
}

const MEDIA_ASSET_FORMATS = [
  "image",
  "video",
  "audio",
] as const satisfies ReadonlyArray<FileFormat>

type ListAssetsFolderOptions = {
  name?: string
  format?: FileFormat
  limit?: number
}

export type AssetFolderFileNode = FileNode & {
  url: string | null
}

/**
 * Lists media file nodes under a folder (recursive), joining `assets` for the
 * media URL in one query. Optional name search uses the same ranking as
 * project-wide name search.
 */
export const listFileNodesUnderFolder = async (
  projectId: string,
  folderId: string,
  options?: ListAssetsFolderOptions,
): Promise<AssetFolderFileNode[]> => {
  const limit = options?.limit ?? 100
  const formats = options?.format ? [options.format] : [...MEDIA_ASSET_FORMATS]
  const normalizedName = options?.name?.trim() ?? ""

  const nameFilter = normalizedName
    ? sql`AND fn.name ILIKE ${`%${escapeLikePattern(normalizedName)}%`} ESCAPE '\\'`
    : sql``

  const exactName = normalizedName.toLowerCase()
  const prefixPattern = normalizedName
    ? `${escapeLikePattern(normalizedName)}%`
    : ""

  const orderBy = normalizedName
    ? sql`
            ORDER BY
              CASE
                WHEN lower(fn.name) = ${exactName} THEN 0
                WHEN fn.name ILIKE ${prefixPattern} ESCAPE '\\' THEN 1
                ELSE 2
              END,
              similarity(fn.name, ${normalizedName}) DESC,
              length(fn.name),
              fn.name ASC
          `
    : sql`ORDER BY fn.name ASC`

  const folder = await getFileNodeById(projectId, folderId)
  if (!folder?.path) {
    return []
  }

  const result = await db.execute(sql`
        SELECT
            fn.id,
            fn.project_id AS "projectId",
            fn.name,
            fn.directory,
            fn.parent_id AS "parentId",
            fn.position,
            fn.editable,
            fn.content_editable AS "contentEditable",
            fn.format,
            fn.path,
            fn.created_at AS "createdAt",
            fn.updated_at AS "updatedAt",
            a.url AS url
        FROM file_nodes fn
        LEFT JOIN assets a
          ON a.file_node_id = fn.id
         AND a.project_id = ${projectId}
        WHERE fn.project_id = ${projectId}
          AND fn.path <@ ${folder.path}::ltree
          AND fn.path <> ${folder.path}::ltree
          AND fn.directory = false
          AND fn.format IN (${sql.join(
            formats.map((format) => sql`${format}`),
            sql`, `,
          )})
          ${nameFilter}
        ${orderBy}
        LIMIT ${limit}
    `)

  return result.rows as AssetFolderFileNode[]
}

export type FolderMediaFile = {
  id: string
  name: string
  path: string
  url: string
  type: (typeof MEDIA_ASSET_FORMATS)[number]
}

export const listFolderMedia = async (
  projectId: string,
  folderId: string,
  options?: { format?: FileFormat; limit?: number },
): Promise<FolderMediaFile[]> => {
  const limit = options?.limit ?? 100
  const formats = options?.format ? [options.format] : [...MEDIA_ASSET_FORMATS]

  const rows = await db
    .select({
      id: fileNodes.id,
      name: fileNodes.name,
      path: fileNodes.path,
      url: assets.url,
      type: fileNodes.format,
    })
    .from(fileNodes)
    .innerJoin(
      assets,
      and(eq(assets.fileNodeId, fileNodes.id), eq(assets.projectId, projectId)),
    )
    .where(
      and(
        eq(fileNodes.projectId, projectId),
        eq(fileNodes.parentId, folderId),
        eq(fileNodes.directory, false),
        inArray(fileNodes.format, formats),
      ),
    )
    .orderBy(asc(fileNodes.position))
    .limit(limit)

  return rows.filter(
    (row): row is FolderMediaFile =>
      Boolean(row.url) &&
      row.type !== null &&
      MEDIA_ASSET_FORMATS.includes(row.type as FolderMediaFile["type"]),
  )
}

export const getFileNodeDepthById = async (projectId: string, id: string) => {
  const fileNode = await getFileNodeById(projectId, id)
  if (!fileNode) {
    return null
  }
  return ltreeDepth(fileNode.path)
}

export const getFileNodeSubtreeHeight = async (
  projectId: string,
  id: string,
) => {
  const fileNode = await getFileNodeById(projectId, id)
  if (!fileNode) {
    return null
  }

  const result = await db.execute(sql`
        SELECT COALESCE(MAX(nlevel(path)), nlevel(${fileNode.path}::ltree))
          - nlevel(${fileNode.path}::ltree) AS depth
        FROM file_nodes
        WHERE project_id = ${projectId}
          AND path <@ ${fileNode.path}::ltree
    `)

  const row = result.rows[0] as { depth?: number | string } | undefined

  if (!row) {
    return 0
  }

  return typeof row.depth === "string" ? Number(row.depth) : (row.depth ?? 0)
}

export const isFileNodeInAncestorChain = async (
  projectId: string,
  startId: string,
  targetAncestorId: string,
) => {
  const [startNode, ancestorNode] = await Promise.all([
    getFileNodeById(projectId, startId),
    getFileNodeById(projectId, targetAncestorId),
  ])
  if (!startNode || !ancestorNode) {
    return false
  }

  const result = await db.execute(sql`
        SELECT ${startNode.path}::ltree <@ ${ancestorNode.path}::ltree AS exists
    `)

  const row = result.rows[0] as { exists?: boolean } | undefined
  return row?.exists ?? false
}

export const createFileNode = async (data: FileCreationRequest) => {
  const path = await resolveChildPath(
    db,
    data.projectId,
    data.parentId,
    data.name,
  )
  const result = await db
    .insert(fileNodes)
    .values({ ...data, path })
    .onConflictDoNothing()
    .returning()
  if (result.length === 0) {
    return null
  }
  return result[0]
}

export const deleteFileNode = async (projectId: string, id: string) => {
  const result = await db
    .delete(fileNodes)
    .where(and(eq(fileNodes.id, id), eq(fileNodes.projectId, projectId)))
    .returning()
  return result.length > 0
}

export const updateFileNode = async (
  projectId: string,
  data: UpdateFileRequest,
) => {
  try {
    return await db.transaction(async (tx) => {
      const source = await tx
        .select()
        .from(fileNodes)
        .where(
          and(eq(fileNodes.projectId, projectId), eq(fileNodes.id, data.id)),
        )
      const sourceFileNode = source[0]
      if (!sourceFileNode) {
        return undefined
      }

      const patch: Partial<Pick<FileNode, "name" | "parentId">> = {}
      if (data.name !== undefined) {
        patch.name = data.name
      }
      if (data.parentId !== undefined) {
        patch.parentId = data.parentId
      }

      const nextName = data.name ?? sourceFileNode.name
      const nextParentId =
        data.parentId === undefined ? sourceFileNode.parentId : data.parentId
      const newPath = await resolveChildPath(
        tx,
        projectId,
        nextParentId,
        nextName,
      )

      const result = await tx
        .update(fileNodes)
        .set(patch)
        .where(
          and(eq(fileNodes.id, data.id), eq(fileNodes.projectId, projectId)),
        )
        .returning()
      const updated = result[0]
      if (!updated) {
        return undefined
      }

      await rewriteSubtreePaths(tx, projectId, sourceFileNode.path, newPath)
      return { ...updated, path: newPath }
    })
  } catch (error) {
    if (isFileNodeUniqueConstraintError(error)) {
      throw new FileNodeUniqueConstraintError(
        "File name already exists in that parent directory.",
      )
    }
    throw error
  }
}

export const moveFileNode = async (
  projectId: string,
  data: {
    id: string
    name: string
    parentId: string | null
    anchorId: string | null
    position: FileNodeInsertPosition
  },
) => {
  try {
    return db.transaction(async (tx) => {
      const source = await tx
        .select()
        .from(fileNodes)
        .where(
          and(eq(fileNodes.projectId, projectId), eq(fileNodes.id, data.id)),
        )
      const sourceFileNode = source[0]
      if (!sourceFileNode) {
        return null
      }

      const destinationSiblings =
        sourceFileNode.parentId === data.parentId
          ? await listDirectoryFilesForExecutor(
              tx,
              projectId,
              sourceFileNode.parentId,
            )
          : await listDirectoryFilesForExecutor(tx, projectId, data.parentId)

      const siblingTargets = destinationSiblings.filter(
        (sibling) => sibling.id !== sourceFileNode.id,
      )
      const insertionPlan = buildInsertionPlan(
        siblingTargets,
        sourceFileNode.id,
        data.anchorId,
        data.position,
      )

      const updated = await tx
        .update(fileNodes)
        .set({
          name: data.name,
          parentId: data.parentId,
          position: insertionPlan.position,
        })
        .where(
          and(
            eq(fileNodes.projectId, projectId),
            eq(fileNodes.id, sourceFileNode.id),
          ),
        )
        .returning()

      if (!updated[0]) {
        return null
      }

      const newPath = await resolveChildPath(
        tx,
        projectId,
        data.parentId,
        data.name,
      )
      await rewriteSubtreePaths(tx, projectId, sourceFileNode.path, newPath)

      if (insertionPlan.orderedIds) {
        await applyOrderedPositions(tx, projectId, insertionPlan.orderedIds)
      }
      return { ...updated[0], path: newPath }
    })
  } catch (error) {
    if (isFileNodeUniqueConstraintError(error)) {
      throw new FileNodeUniqueConstraintError(
        "File name already exists in that parent directory.",
      )
    }
    throw error
  }
}

export const updateFileNodePositions = async (
  projectId: string,
  orderedIds: string[],
) => {
  await applyOrderedPositions(db, projectId, orderedIds)
  return true
}

export const areFileNodesInSameDirectory = async (
  projectId: string,
  fileIds: string[],
) => {
  if (fileIds.length === 0) {
    return true
  }

  const uniqueFileIds = [...new Set(fileIds)]
  const result = await db
    .select({
      id: fileNodes.id,
      parentId: fileNodes.parentId,
    })
    .from(fileNodes)
    .where(
      and(
        eq(fileNodes.projectId, projectId),
        sql`${fileNodes.id} = ANY(${uniqueFileIds})`,
      ),
    )

  if (result.length !== uniqueFileIds.length) {
    return false
  }

  const firstParentId = result[0]?.parentId ?? null
  return result.every(
    (fileNode) => (fileNode.parentId ?? null) === firstParentId,
  )
}

export const updateBulkFileNodes = async (
  projectId: string,
  data: UpdateFileRequest[],
) => {
  if (data.length === 0) {
    return true
  }

  const updatedRows = await db.transaction(async (tx) => {
    const results: FileNode[] = []

    for (const item of data) {
      const current = await tx
        .select()
        .from(fileNodes)
        .where(
          and(eq(fileNodes.projectId, projectId), eq(fileNodes.id, item.id)),
        )
      const currentFileNode = current[0]
      if (!currentFileNode) {
        continue
      }

      const patch: Partial<Pick<FileNode, "name" | "parentId">> = {}

      if ("name" in item) {
        patch.name = item.name
      }

      if ("parentId" in item) {
        patch.parentId = item.parentId
      }

      const nextName = item.name ?? currentFileNode.name
      const nextParentId =
        item.parentId === undefined ? currentFileNode.parentId : item.parentId
      const newPath = await resolveChildPath(
        tx,
        projectId,
        nextParentId,
        nextName,
      )

      const updated = await tx
        .update(fileNodes)
        .set(patch)
        .where(
          and(eq(fileNodes.projectId, projectId), eq(fileNodes.id, item.id)),
        )
        .returning()

      if (updated[0]) {
        await rewriteSubtreePaths(tx, projectId, currentFileNode.path, newPath)
        results.push({ ...updated[0], path: newPath })
      }
    }

    return results
  })

  return updatedRows.length === data.length
}

export const updateFileContent = async (
  projectId: string,
  fileNodeId: string,
  data: UpdateFileContentRequest,
) => {
  const result = await db
    .update(fileNodeContents)
    .set({
      ...data,
      revision: sql`${fileNodeContents.revision} + 1`,
    })
    .where(
      and(
        eq(fileNodeContents.projectId, projectId),
        eq(fileNodeContents.fileNodeId, fileNodeId),
      ),
    )
    .returning()
  return result[0]
}

export const updateFileContentAtRevision = async (
  projectId: string,
  fileNodeId: string,
  data: UpdateFileContentRequest,
  baseRevision: number,
) => {
  const result = await db
    .update(fileNodeContents)
    .set({
      ...data,
      revision: sql`${fileNodeContents.revision} + 1`,
    })
    .where(
      and(
        eq(fileNodeContents.projectId, projectId),
        eq(fileNodeContents.fileNodeId, fileNodeId),
        eq(fileNodeContents.revision, baseRevision),
      ),
    )
    .returning()
  return result[0]
}

type FileContentChunkInsert = {
  chunkIndex: number
  chunkText: string
  tokenCount: number
}

export const replaceFileContentChunks = async (
  projectId: string,
  fileNodeId: string,
  chunks: FileContentChunkInsert[],
) => {
  return db.transaction(async (tx) => {
    await tx
      .delete(fileNodeContentChunks)
      .where(
        and(
          eq(fileNodeContentChunks.projectId, projectId),
          eq(fileNodeContentChunks.fileNodeId, fileNodeId),
        ),
      )

    if (chunks.length === 0) {
      return
    }

    await tx.insert(fileNodeContentChunks).values(
      chunks.map((chunk) => ({
        projectId,
        fileNodeId,
        chunkIndex: chunk.chunkIndex,
        chunkText: chunk.chunkText,
        embedding: null,
        embeddingMetadata: null,
        tokenCount: chunk.tokenCount,
      })),
    )
  })
}

export type InitialFileContent = {
  markdown?: string
  json?: Record<string, unknown>
  skill?: {
    description?: string
    instructions?: string
  }
}

export const createFileWithContentAtPosition = async (
  projectId: string,
  data: FileCreationRequest,
  anchorId: string | null,
  position: FileNodeInsertPosition,
  initialContent?: InitialFileContent,
) => {
  return db.transaction(async (tx) => {
    const siblings = await listDirectoryFilesForExecutor(
      tx,
      projectId,
      data.parentId,
    )
    const provisionalPosition = getNextPositionFromSiblings(siblings)
    const path = await resolveChildPath(tx, projectId, data.parentId, data.name)
    const file = await tx
      .insert(fileNodes)
      .values({ ...data, position: provisionalPosition, path })
      .onConflictDoNothing()
      .returning()
    if (file.length === 0) {
      return null
    }

    const insertedFile = file[0]
    await createContentBasedOnFormat(
      tx,
      insertedFile,
      projectId,
      initialContent,
    )

    const insertionPlan = buildInsertionPlan(
      siblings,
      insertedFile.id,
      anchorId,
      position,
    )

    if (insertionPlan.position !== provisionalPosition) {
      await tx
        .update(fileNodes)
        .set({ position: insertionPlan.position })
        .where(
          and(
            eq(fileNodes.projectId, projectId),
            eq(fileNodes.id, insertedFile.id),
          ),
        )
    }

    if (insertionPlan.orderedIds) {
      await applyOrderedPositions(tx, projectId, insertionPlan.orderedIds)
    }
    return insertedFile
  })
}

async function createContentBasedOnFormat(
  tx: DbTransaction,
  fileNode: FileNode,
  projectId: string,
  initialContent?: InitialFileContent,
) {
  switch (fileNode.format) {
    case "markdown":
      await tx.insert(fileNodeContents).values({
        projectId,
        fileNodeId: fileNode.id,
        content: initialContent?.markdown ?? "",
      })
      break
    case "json":
      await tx.insert(fileNodeContents).values({
        projectId,
        fileNodeId: fileNode.id,
        jsonContent: initialContent?.json ?? {},
        content: "",
      })
      break
    case "skill":
      await tx.insert(skills).values({
        name: fileNode.name,
        fileNodeId: fileNode.id,
        description: initialContent?.skill?.description ?? "",
        instructions: initialContent?.skill?.instructions ?? "",
      })
      break
    case "video-editor":
      await tx.insert(videoCompositions).values({
        projectId,
        fileNodeId: fileNode.id,
      })
      break
  }
}

export const createFileWithContent = async (
  projectId: string,
  data: FileCreationRequest,
  _content: UpdateFileContentRequest,
  initialContent?: InitialFileContent,
) => {
  return createFileWithContentAtPosition(
    projectId,
    data,
    null,
    "end",
    initialContent,
  )
}

export const insertFileNodeInDirectory = async (
  projectId: string,
  data: {
    id: string
    parentId: string | null
    anchorId: string | null
    position: FileNodeInsertPosition
  },
) => {
  return db.transaction(async (tx) => {
    const source = await tx
      .select()
      .from(fileNodes)
      .where(and(eq(fileNodes.projectId, projectId), eq(fileNodes.id, data.id)))
    const sourceFileNode = source[0]
    if (!sourceFileNode) {
      return null
    }

    const destinationSiblings =
      sourceFileNode.parentId === data.parentId
        ? await listDirectoryFilesForExecutor(
            tx,
            projectId,
            sourceFileNode.parentId,
          )
        : await listDirectoryFilesForExecutor(tx, projectId, data.parentId)

    const siblingTargets = destinationSiblings.filter(
      (sibling) => sibling.id !== sourceFileNode.id,
    )
    const insertionPlan = buildInsertionPlan(
      siblingTargets,
      sourceFileNode.id,
      data.anchorId,
      data.position,
    )

    const updated = await tx
      .update(fileNodes)
      .set({
        parentId: data.parentId,
        position: insertionPlan.position,
      })
      .where(
        and(
          eq(fileNodes.projectId, projectId),
          eq(fileNodes.id, sourceFileNode.id),
        ),
      )
      .returning()

    if (!updated[0]) {
      return null
    }

    const newPath = await resolveChildPath(
      tx,
      projectId,
      data.parentId,
      sourceFileNode.name,
    )
    await rewriteSubtreePaths(tx, projectId, sourceFileNode.path, newPath)

    if (insertionPlan.orderedIds) {
      await applyOrderedPositions(tx, projectId, insertionPlan.orderedIds)
    }
    return { ...updated[0], path: newPath }
  })
}

async function listDirectoryFilesForExecutor(
  executor: DbExecutor,
  projectId: string,
  parentId: string | null,
) {
  return executor
    .select()
    .from(fileNodes)
    .where(
      and(
        eq(fileNodes.projectId, projectId),
        parentId === null
          ? isNull(fileNodes.parentId)
          : eq(fileNodes.parentId, parentId),
      ),
    )
    .orderBy(asc(fileNodes.position))
}

async function applyOrderedPositions(
  executor: Pick<typeof db, "execute">,
  projectId: string,
  orderedIds: string[],
) {
  if (orderedIds.length === 0) {
    return
  }

  const caseStatements = orderedIds
    .map((id, index) => `WHEN '${id}' THEN ${(index + 1) * ORDER_GAP}`)
    .join(" ")

  await executor.execute(sql`
        UPDATE file_nodes
        SET position = CASE id ${sql.raw(caseStatements)} END
        WHERE project_id = ${projectId}
          AND id = ANY(${orderedIds})
    `)
}

function getNextPositionFromSiblings(siblings: Array<{ position: number }>) {
  const lastPosition = siblings[siblings.length - 1]?.position ?? 0
  return lastPosition + ORDER_GAP
}

function buildInsertionPlan(
  siblings: Array<{ id: string; position: number }>,
  fileNodeId: string,
  anchorId: string | null,
  position: FileNodeInsertPosition,
) {
  const insertIndex = resolveInsertionIndex(
    siblings.map((sibling) => sibling.id),
    anchorId,
    position,
  )
  const previousSibling = siblings[insertIndex - 1]
  const nextSibling = siblings[insertIndex]

  if (!previousSibling && !nextSibling) {
    return { position: ORDER_GAP }
  }

  if (!previousSibling && nextSibling) {
    return { position: nextSibling.position - ORDER_GAP }
  }

  if (previousSibling && !nextSibling) {
    return { position: previousSibling.position + ORDER_GAP }
  }

  if (!previousSibling || !nextSibling) {
    throw new FileNodeInsertionError("Unable to resolve insertion position.")
  }

  const positionGap = nextSibling.position - previousSibling.position
  if (positionGap > 1) {
    return {
      position: Math.floor(
        (previousSibling.position + nextSibling.position) / 2,
      ),
    }
  }

  const orderedIds = siblings.map((sibling) => sibling.id)
  orderedIds.splice(insertIndex, 0, fileNodeId)
  return {
    position: (insertIndex + 1) * ORDER_GAP,
    orderedIds,
  }
}

function resolveInsertionIndex(
  siblingIds: string[],
  anchorId: string | null,
  position: FileNodeInsertPosition,
) {
  switch (position) {
    case "start":
      return 0
    case "end":
      return siblingIds.length
    case "before":
    case "after": {
      if (!anchorId) {
        throw new FileNodeInsertionError(
          `anchorId is required when position is ${position}.`,
        )
      }

      const anchorIndex = siblingIds.findIndex((id) => id === anchorId)
      if (anchorIndex === -1) {
        throw new FileNodeInsertionError(
          `Anchor file "${anchorId}" was not found in the target directory.`,
        )
      }

      return position === "before" ? anchorIndex : anchorIndex + 1
    }
  }
}

export const listDirectoryFiles = async (
  projectId: string,
  parentId: string | null,
) => {
  // We get only a single level of files under the parentId
  const result = await db
    .select()
    .from(fileNodes)
    .where(
      and(
        eq(fileNodes.projectId, projectId),
        parentId === null
          ? isNull(fileNodes.parentId)
          : eq(fileNodes.parentId, parentId),
      ),
    )
    .orderBy(asc(fileNodes.position))
  return result
}

export const getNextFileNodePosition = async (
  projectId: string,
  parentId: string | null,
) => {
  const siblings = await listDirectoryFiles(projectId, parentId)
  return getNextPositionFromSiblings(siblings)
}

export const getFileContentById = async (
  projectId: string,
  fileNodeId: string,
) => {
  const result = await db
    .select()
    .from(fileNodeContents)
    .where(
      and(
        eq(fileNodeContents.projectId, projectId),
        eq(fileNodeContents.fileNodeId, fileNodeId),
      ),
    )
  return result[0]
}

export const getFileNodePathById = async (
  projectId: string,
  fileNodeId: string,
) => {
  const fileNode = await getFileNodeById(projectId, fileNodeId)
  if (!fileNode) {
    return null
  }
  return toApiPath(fileNode.path)
}

export const searchProjectChunksByKeyword = async (
  projectId: string,
  keyword: string,
  limit = 20,
) => {
  const normalizedKeyword = keyword.trim()

  if (!normalizedKeyword) {
    return []
  }

  const result = await db.execute(sql`
        WITH search AS (
            SELECT websearch_to_tsquery('simple', ${normalizedKeyword}) AS query
        ),
        matched_chunks AS (
            SELECT
                chunks.id,
                chunks.file_node_id,
                chunks.chunk_index,
                chunks.chunk_text,
                ts_rank_cd(chunks.search_text, search.query) AS rank
            FROM file_node_content_chunks chunks
            CROSS JOIN search
            WHERE chunks.project_id = ${projectId}
              AND chunks.search_text @@ search.query
        ),
        ranked_documents AS (
            SELECT
                id,
                file_node_id,
                chunk_text,
                rank,
                COUNT(*) OVER (PARTITION BY file_node_id) AS total_chunks_matched,
                ROW_NUMBER() OVER (
                    PARTITION BY file_node_id
                    ORDER BY rank DESC, chunk_index ASC
                ) AS chunk_rn
            FROM matched_chunks
        )
        SELECT
            ranked_documents.id,
            ranked_documents.file_node_id AS "fileNodeId",
            ranked_documents.total_chunks_matched::int AS "totalChunksMatched",
            '/' || replace(fn.path::text, '.', '/') AS path,
            ts_headline(
                'simple',
                ranked_documents.chunk_text,
                search.query,
                'StartSel=**, StopSel=**, MaxWords=50, MinWords=15'
            ) AS snippet
        FROM ranked_documents
        JOIN file_nodes fn
          ON fn.id = ranked_documents.file_node_id
         AND fn.project_id = ${projectId}
        CROSS JOIN search
        WHERE ranked_documents.chunk_rn = 1
        ORDER BY ranked_documents.rank DESC
        LIMIT ${limit}
    `)

  return result.rows as Array<{
    id: string
    fileNodeId: string
    totalChunksMatched: number
    path: string
    snippet: string
  }>
}

export const getSkillByFileID = async (fileId: string) => {
  const response = await db
    .select()
    .from(skills)
    .where(and(eq(skills.fileNodeId, fileId)))
  return response[0] ?? null
}

export const updateSkill = async (
  fileId: string,
  request: UpdateSkillRequest,
) => {
  const payload = {
    ...(request.description !== undefined
      ? { description: request.description }
      : {}),
    ...(request.instructions !== undefined
      ? { instructions: request.instructions }
      : {}),
    ...(request.status !== undefined ? { status: request.status } : {}),
    ...(request.visibility !== undefined
      ? { visibility: request.visibility }
      : {}),
  }
  const response = await db
    .update(skills)
    .set(payload)
    .where(and(eq(skills.fileNodeId, fileId)))
    .returning()
  return response[0]
}

export const upsertPendingFileOperation = async (
  projectId: string,
  fileNodeId: string,
  payload: FilePendingOperation,
) => {
  const response = await db
    .insert(pendingFileOperations)
    .values({
      projectId,
      fileNodeId,
      operation: payload.type,
      payload,
    })
    .onConflictDoUpdate({
      target: [pendingFileOperations.fileNodeId],
      set: {
        payload: payload,
        operation: payload.type,
        diffApplied: false,
      },
    })
    .returning()

  return response[0]
}

export const listPendingFileOperations = async (projectId: string) => {
  const response = await db
    .select()
    .from(pendingFileOperations)
    .where(eq(pendingFileOperations.projectId, projectId))
  return response
}

export const getPendingFileOperation = async (fileNodeId: string) => {
  const response = await db
    .select()
    .from(pendingFileOperations)
    .where(eq(pendingFileOperations.fileNodeId, fileNodeId))
  return response[0] ?? null
}

export const deletePendingFileOperation = async (fileNodeId: string) => {
  const response = await db
    .delete(pendingFileOperations)
    .where(eq(pendingFileOperations.fileNodeId, fileNodeId))
  if (response.rowCount === 0) {
    return false
  }
  return true
}

export const markPendingFileOperationDiffApplied = async (
  fileNodeId: string,
) => {
  const response = await db
    .update(pendingFileOperations)
    .set({ diffApplied: true })
    .where(eq(pendingFileOperations.fileNodeId, fileNodeId))
  if (response.rowCount === 0) {
    return false
  }
  return true
}

export const listSkills = async (projectId: string) => {
  const projectSkills = await db
    .select({
      name: fileNodes.name,
      description: skills.description,
      instructions: skills.instructions,
    })
    .from(fileNodes)
    .innerJoin(skills, eq(fileNodes.id, skills.fileNodeId))
    .where(
      and(
        eq(fileNodes.projectId, projectId),
        eq(fileNodes.format, "skill"),
        eq(skills.status, "published"),
      ),
    )

  const catalogSkills = await db
    .select({
      name: skills.name,
      description: skills.description,
      instructions: skills.instructions,
    })
    .from(skills)
    .where(
      and(
        isNull(skills.fileNodeId),
        eq(skills.status, "published"),
        eq(skills.visibility, "public"),
      ),
    )

  const byName = new Map<
    string,
    { name: string; description: string; instructions: string }
  >()
  for (const skill of catalogSkills) {
    byName.set(skill.name.toLowerCase(), skill)
  }
  // Project skills win on name collision
  for (const skill of projectSkills) {
    byName.set(skill.name.toLowerCase(), skill)
  }

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export const getSkillByName = async (projectId: string, name: string) => {
  const fileResponse = await db
    .select()
    .from(fileNodes)
    .where(
      and(
        eq(fileNodes.projectId, projectId),
        eq(fileNodes.name, name),
        eq(fileNodes.format, "skill"),
      ),
    )
  const fileNode = fileResponse[0]
  if (fileNode) {
    const skillResponse = await db
      .select()
      .from(skills)
      .where(and(eq(skills.fileNodeId, fileNode.id)))
    const skill = skillResponse[0]
    if (skill) {
      if (skill.status !== "published") {
        return null
      }
      return skill
    }
  }

  const catalogResponse = await db
    .select()
    .from(skills)
    .where(
      and(
        isNull(skills.fileNodeId),
        eq(skills.name, name),
        eq(skills.status, "published"),
        eq(skills.visibility, "public"),
      ),
    )
    .limit(1)
  return catalogResponse[0] ?? null
}

// ================================
