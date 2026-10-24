import { BadRequest, Conflict, InternalServerError, NotFound } from "../error"
import * as projectRepo from "../project/repo"
import { FileFormat, FileType, fileFormat, fileType } from "./constants"
import { isAssetFileKind } from "./file-kind"
import {
  FileSystemConflictError,
  FileSystemInputError,
  FileSystemNotFoundError,
  FileSystemOperationError,
  createFileNode as createFileNodeFn,
  getFileContent as getFileContentFn,
  searchProjectContent as searchProjectContentFn,
  updateFileContent as updateFileContentFn,
  updateFileNode as updateFileNodeFn,
} from "./functions"
import {
  FileCreationRequest,
  UpdateFileRequest,
  UpdateSkillRequest,
  UpdateTextFileContentRequest,
} from "./payload"
import * as fileSystemRepo from "./repo"
import * as mediaRepo from "../media-engine/repo"
import { ingestFileContentChunks } from "./ingest-file-content-chunks"
import { CursorPaginationOptions } from "@/type"
import * as videoEditorRepo from "../video-editor/repo"
import { fromApiPath, serializeFileNode, toApiPath } from "./utils"
import {
  DIRECTORY_CHILDREN_PAGE_SIZE,
  decodeDirectoryChildCursor,
  previewUrlForChild,
  sliceDirectoryChildrenPage,
} from "./directory-children"
import {
  EMPTY_SKILL_CONTENT,
  parseSkillDocument,
  resolveSkillFileMetadata,
} from "./skill-document"

// List file trees -> ok
// rename file
// reorder files
// move
// delete -> ok
// create file/directory -> ok
// get file content -> ok

export const createFileNode = async (data: FileCreationRequest) => {
  try {
    const fileNode = await createFileNodeFn(data)
    if (
      !data.directory &&
      (data.type === fileType.DOCUMENT ||
        data.type === fileType.STORYBOARD ||
        data.type === fileType.SKILL) &&
      data.format === fileFormat.MARKDOWN
    ) {
      const content =
        (await fileSystemRepo.getFileContentById(data.projectId, fileNode.id))
          ?.content ?? ""
      await ingestFileContentChunks({
        projectId: data.projectId,
        fileNodeId: fileNode.id,
        content,
      })
    }
    return serializeFileNode(fileNode)
  } catch (error) {
    if (
      error instanceof FileSystemConflictError ||
      error instanceof FileSystemInputError
    ) {
      throw new BadRequest(error.message)
    }
    console.error(error)
    throw new InternalServerError("Something went wrong")
  }
}

export const deleteFileNode = async (projectId: string, fileId: string) => {
  try {
    const fileNode = await fileSystemRepo.getFileNodeById(projectId, fileId)
    if (!fileNode) {
      throw new NotFound("File not found")
    }
    if (!fileNode.editable) {
      throw new BadRequest("Cannot delete a built-in file")
    }
    const isDeleted = await fileSystemRepo.deleteFileNode(projectId, fileId)
    if (!isDeleted) {
      throw new InternalServerError("Failed to delete file. Try again later.")
    }
    return { ok: true, data: fileId }
  } catch (error) {
    if (error instanceof FileSystemOperationError) {
      throw new BadRequest(error.message)
    }
    console.error(error)
    throw new InternalServerError("Something went wrong")
  }
}

type CompactTextDiff = {
  version: 1
  baseLength: number
  targetLength: number
  edits: Array<{
    start: number
    deleteCount: number
    insert: string
  }>
}

export const updateFileContent = async (
  projectId: string,
  fileNodeId: string,
  data: UpdateTextFileContentRequest,
) => {
  try {
    const fileNode = await fileSystemRepo.getFileNodeById(projectId, fileNodeId)
    if (!fileNode) {
      throw new NotFound("File not found")
    }

    if (fileNode.type === fileType.SKILL) {
      return updateSkillDocument(projectId, fileNodeId, data)
    }

    if (data.diff) {
      const fileContent = await getFileContentFn(projectId, fileNodeId)
      const baseRevision = data.baseRevision

      if (baseRevision === undefined) {
        throw new FileSystemInputError(
          "baseRevision is required when diff is provided",
        )
      }
      if (fileContent.revision !== baseRevision) {
        throw new Conflict("File content changed before diff could be applied")
      }

      const content = applyCompactTextDiff(fileContent.content ?? "", data.diff)
      const updated = await fileSystemRepo.updateFileContentAtRevision(
        projectId,
        fileNodeId,
        { content },
        baseRevision,
      )

      if (!updated) {
        throw new Conflict("File content changed before diff could be applied")
      }

      await ingestFileContentChunks({
        projectId,
        fileNodeId,
        content: updated.content ?? content,
      })

      return updated
    }

    const content = data.content ?? ""
    const updatedFileContent = await updateFileContentFn(
      projectId,
      fileNodeId,
      { content },
    )
    const pendingDiffApplied = data.diffApplied
      ? await fileSystemRepo.markPendingFileOperationDiffApplied(
          fileNodeId,
          content,
        )
      : false
    return { ...updatedFileContent, pendingDiffApplied }
  } catch (error) {
    if (error instanceof Conflict || error instanceof NotFound) {
      throw error
    }
    if (error instanceof FileSystemInputError) {
      throw new BadRequest(error.message)
    }
    if (error instanceof FileSystemOperationError) {
      throw new InternalServerError(error.message)
    }
    console.error(error)
    throw new InternalServerError("Something went wrong")
  }
}

function applyCompactTextDiff(content: string, diff: CompactTextDiff) {
  if (diff.version !== 1) {
    throw new FileSystemInputError("Unsupported diff version")
  }
  if (content.length !== diff.baseLength) {
    throw new FileSystemInputError(
      "File content changed before diff could be applied",
    )
  }

  let nextContent = content

  for (const edit of [...diff.edits].reverse()) {
    const end = edit.start + edit.deleteCount

    if (edit.start > nextContent.length || end > nextContent.length) {
      throw new FileSystemInputError("Diff edit is out of bounds")
    }

    nextContent = `${nextContent.slice(0, edit.start)}${edit.insert}${nextContent.slice(end)}`
  }

  if (nextContent.length !== diff.targetLength) {
    throw new FileSystemInputError(
      "Diff target length does not match applied content",
    )
  }

  return nextContent
}

export const getFileNodeByPath = async (projectId: string, apiPath: string) => {
  await validateProject(projectId)
  const ltreePath = fromApiPath(apiPath)
  if (!ltreePath) {
    throw new BadRequest("Invalid path")
  }
  const fileNode = await fileSystemRepo.getFileNodeByPath(projectId, ltreePath)
  if (!fileNode) {
    throw new NotFound("File not found")
  }
  return serializeFileNode(fileNode)
}

export const getFileNodeById = async (projectId: string, fileId: string) => {
  await validateProject(projectId)
  const fileNode = await fileSystemRepo.getFileNodeById(projectId, fileId)
  if (!fileNode) {
    throw new NotFound("File not found")
  }
  return serializeFileNode(fileNode)
}

export const listFileTreePerLevel = async (
  projectId: string,
  parentId: string,
) => {
  const fileNode = await fileSystemRepo.getFileNodeById(projectId, parentId)
  if (!fileNode) {
    throw new NotFound("File not found")
  }
  if (!fileNode.directory) {
    throw new BadRequest("Parent is not a directory")
  }
  return fileSystemRepo
    .listDirectoryFiles(projectId, parentId)
    .then((files) => files.map(serializeFileNode))
}

export const listDirectoryChildren = async (
  projectId: string,
  parentId: string,
  options?: { limit?: number; cursor?: string },
) => {
  const parent = await fileSystemRepo.getFileNodeById(projectId, parentId)
  if (!parent) {
    throw new NotFound("File not found")
  }
  if (!parent.directory) {
    throw new BadRequest("Parent is not a directory")
  }

  const limit = options?.limit ?? DIRECTORY_CHILDREN_PAGE_SIZE
  const cursor = options?.cursor
    ? decodeDirectoryChildCursor(options.cursor)
    : null
  if (options?.cursor && !cursor) {
    throw new BadRequest("Invalid cursor")
  }

  const rows = await fileSystemRepo.listDirectoryChildrenPage(
    projectId,
    parentId,
    { limit, cursor },
  )
  const page = sliceDirectoryChildrenPage(rows, limit)

  return {
    data: page.data.map((row) => ({
      ...serializeFileNode(row),
      previewUrl: previewUrlForChild(row.type, row.previewUrl),
    })),
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
  }
}

export const getFileContent = async (
  projectId: string,
  fileNodeId: string,
  _paginationOptions?: CursorPaginationOptions,
) => {
  const fileNode = await fileSystemRepo.getFileNodeById(projectId, fileNodeId)
  if (!fileNode) {
    throw new NotFound("File not found")
  }
  if (fileNode.directory) {
    throw new BadRequest("File is a directory")
  }

  const fileMeta = {
    id: fileNode.id,
    name: fileNode.name,
    path: toApiPath(fileNode.path),
  }

  switch (fileNode.type) {
    case fileType.STORYBOARD:
    case fileType.DOCUMENT: {
      if (isAssetFileKind(fileNode.type, fileNode.format)) {
        const asset = await mediaRepo.getAssetByFileNodeId(
          projectId,
          fileNodeId,
        )
        return {
          type: asset.type,
          ...fileMeta,
          url: asset.url,
          name: asset.name,
          metadata: asset.metadata,
          storageKey: asset.storageKey,
        }
      }
      const textContent = await fileSystemRepo.getFileContentById(
        projectId,
        fileNodeId,
      )
      if (!textContent) {
        throw new NotFound("File content not found")
      }
      if (fileNode.format === fileFormat.JSON) {
        return {
          type: "json" as const,
          ...fileMeta,
          content: textContent.jsonContent ?? {},
          revision: textContent.revision,
          updatedAt: textContent.updatedAt,
        }
      }
      return {
        type:
          fileNode.type === fileType.STORYBOARD
            ? ("storyboard" as const)
            : ("markdown" as const),
        ...fileMeta,
        content: textContent.content,
        revision: textContent.revision,
        updatedAt: textContent.updatedAt,
      }
    }
    case fileType.AUDIO:
    case fileType.VIDEO:
    case fileType.IMAGE: {
      const asset = await mediaRepo.getAssetByFileNodeId(projectId, fileNodeId)
      return {
        type: asset.type,
        ...fileMeta,
        url: asset.url,
        name: asset.name,
        metadata: asset.metadata,
        storageKey: asset.storageKey,
      }
    }
    case fileType.SKILL: {
      const textContent = await fileSystemRepo.getFileContentById(
        projectId,
        fileNodeId,
      )
      if (!textContent) {
        throw new NotFound("Skill content not found")
      }
      const flags = resolveSkillFileMetadata(fileNode.metadata)
      return {
        type: "skill" as const,
        ...fileMeta,
        content: textContent.content ?? EMPTY_SKILL_CONTENT,
        revision: textContent.revision,
        updatedAt: textContent.updatedAt,
        status: flags.status,
        visibility: flags.visibility,
      }
    }
    case fileType.VIDEO_EDITOR: {
      const videoEditor =
        await videoEditorRepo.getFullCompositionByFileNodeId(fileNodeId)
      if (!videoEditor) {
        throw new NotFound("Video editor not found")
      }
      return { type: "video-editor" as const, ...fileMeta, data: videoEditor }
    }
    default:
      throw new BadRequest("Unsupported file type")
  }
}

// ==============================

export const searchFileContent = async (request: {
  projectId: string
  keyword: string
  limit?: number
}) => {
  await validateProject(request.projectId)
  return searchProjectContentFn(request)
}

export const searchFilesByName = async (request: {
  projectId: string
  name: string
  limit?: number
  directory?: boolean
  type?: FileType
  format?: FileFormat
}) => {
  await validateProject(request.projectId)
  const files = await fileSystemRepo.searchFileNodesByName(
    request.projectId,
    request.name,
    request.limit ?? 15,
    {
      directory: request.directory,
      type: request.type,
      format: request.format,
    },
  )
  return files.map(serializeFileNode)
}

export const listFilesByType = async (request: {
  projectId: string
  type: FileType
  limit?: number
}) => {
  await validateProject(request.projectId)
  const files = await fileSystemRepo.searchFileNodesByType(
    request.projectId,
    request.type,
    request.limit ?? 100,
  )
  return files.map(serializeFileNode)
}

export const listFilesByFormat = async (request: {
  projectId: string
  format: FileFormat
  limit?: number
}) => {
  await validateProject(request.projectId)
  const files = await fileSystemRepo.searchFileNodesByFormat(
    request.projectId,
    request.format,
    request.limit ?? 100,
  )
  return files.map(serializeFileNode)
}

export const listFolderMedia = async (
  projectId: string,
  folderId: string,
  options?: { type?: FileType; limit?: number },
) => {
  await validateProject(projectId)
  const folder = await fileSystemRepo.getFileNodeById(projectId, folderId)
  if (!folder) {
    throw new NotFound("Folder not found")
  }
  if (!folder.directory) {
    throw new BadRequest("Required a folder to list media from")
  }
  return fileSystemRepo
    .listFolderMedia(projectId, folderId, options)
    .then((files) =>
      files.map((file) => ({
        ...file,
        path: toApiPath(file.path),
      })),
    )
}

export const listAssetsFolder = async (request: {
  projectId: string
  name?: string
  type?: FileType
  limit?: number
}) => {
  await validateProject(request.projectId)
  const { assetsFolder } = await mediaRepo.getAssetFolder(request.projectId)
  if (!assetsFolder) {
    return []
  }
  return fileSystemRepo
    .listFileNodesUnderFolder(request.projectId, assetsFolder.id, {
      name: request.name,
      type: request.type,
      limit: request.limit ?? 100,
    })
    .then((files) => files.map(serializeFileNode))
}

export const updateFileNode = async (
  projectId: string,
  request: UpdateFileRequest,
) => {
  await validateProject(projectId)
  try {
    const updated = await updateFileNodeFn(projectId, request)
    return updated ? serializeFileNode(updated) : updated
  } catch (error) {
    if (
      error instanceof FileSystemConflictError ||
      error instanceof FileSystemInputError
    ) {
      throw new BadRequest(error.message)
    }
    if (error instanceof FileSystemNotFoundError) {
      console.error(error.message)
      throw new NotFound(error.message)
    }
    if (error instanceof FileSystemOperationError) {
      throw new InternalServerError(error.message)
    }
    throw error
  }
}

// ======= SKILLS content management ================================

export const getSkillByFileID = async (projectId: string, fileId: string) => {
  await validateProject(projectId)

  const file = await fileSystemRepo.getFileNodeById(projectId, fileId)
  if (!file || file.type !== fileType.SKILL) {
    throw new NotFound("Skill not found")
  }
  const content = await fileSystemRepo.getFileContentById(projectId, fileId)
  if (!content?.content) throw new NotFound("Skill content not found")
  const skill = parseSkillContent(content.content)
  return {
    id: file.id,
    name: file.name,
    ...skill,
    ...resolveSkillFileMetadata(file.metadata),
  }
}

export const updateSkill = async (
  projectId: string,
  fileId: string,
  request: UpdateSkillRequest,
) => {
  await validateProject(projectId)
  const skill = await fileSystemRepo.updateSkill(projectId, fileId, request)
  if (!skill) {
    throw new NotFound("Skill not found")
  }
  return {
    id: skill.id,
    name: skill.name,
    ...resolveSkillFileMetadata(skill.metadata),
    updatedAt: skill.updatedAt,
  }
}

// ============================== PENDING FILE OPERATIONS ==============================

export const listPendingFileOperations = async (projectId: string) => {
  await validateProject(projectId)
  return fileSystemRepo.listPendingFileOperations(projectId)
}

export const getPendingFileOperation = async (
  projectId: string,
  fileNodeId: string,
) => {
  await validateProject(projectId)
  const pendingOperation =
    await fileSystemRepo.getPendingFileOperation(fileNodeId)
  return {
    operation: pendingOperation,
  }
}

export const deletePendingFileOperation = async (
  projectId: string,
  fileNodeId: string,
) => {
  await validateProject(projectId)
  return {
    ok: await fileSystemRepo.deletePendingFileOperation(fileNodeId),
  }
}

function parseSkillContent(content: string) {
  const parsed = parseSkillDocument(content)
  if (!parsed) {
    throw new FileSystemInputError(
      "Skill files must use a description frontmatter block.",
    )
  }
  return parsed
}

async function updateSkillDocument(
  projectId: string,
  fileNodeId: string,
  data: UpdateTextFileContentRequest,
) {
  let content: string
  let baseRevision: number | undefined
  if (data.diff) {
    const fileContent = await fileSystemRepo.getFileContentById(
      projectId,
      fileNodeId,
    )
    if (!fileContent) {
      throw new NotFound("File content not found")
    }
    if (data.baseRevision === undefined) {
      throw new FileSystemInputError(
        "baseRevision is required when diff is provided",
      )
    }
    if (fileContent.revision !== data.baseRevision) {
      throw new Conflict("File content changed before diff could be applied")
    }
    baseRevision = data.baseRevision
    content = applyCompactTextDiff(
      fileContent.content ?? EMPTY_SKILL_CONTENT,
      data.diff,
    )
  } else {
    content = data.content ?? ""
  }

  parseSkillContent(content)
  const revisionRow =
    baseRevision === undefined
      ? await updateFileContentFn(projectId, fileNodeId, { content })
      : await fileSystemRepo.updateFileContentAtRevision(
          projectId,
          fileNodeId,
          { content },
          baseRevision,
        )
  if (!revisionRow) {
    if (data.diff) {
      throw new Conflict("File content changed before diff could be applied")
    }
    throw new FileSystemOperationError("Failed to update file content")
  }

  await ingestFileContentChunks({
    projectId,
    fileNodeId,
    content,
  })
  const pendingDiffApplied = data.diffApplied
    ? await fileSystemRepo.markPendingFileOperationDiffApplied(
        fileNodeId,
        content,
      )
    : false

  return { ...revisionRow, content, pendingDiffApplied }
}

// ============================== HELPER FUNCTIONS ==============================
async function validateProject(projectId: string) {
  const project = await projectRepo.getProjectById(projectId)
  if (!project) {
    throw new NotFound("Project not found")
  }
  return project
}
