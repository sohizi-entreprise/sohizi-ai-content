import type { ToolResult, ToolExecutionOptions } from "../tool-definition"
import type { ApiFileSystemRequest } from "./schema"
import { failure, success } from "../utils"
import { SYSTEM_LEVEL_FILES } from "../../constants/system-files"
import type { FileContentPayload } from "@/features/file-system/objects/file"
import * as fileSystemRepo from "@/features/file-system/repo"
import {
  normalizeFileName,
  toApiPath,
  formatKeywordChunkResults,
} from "@/features/file-system/utils"
import { isMarkdownEditable } from "@/features/file-system/file-kind"
import {
  fileType,
  type FileFormat,
  type FileType,
} from "@/features/file-system/constants"
import { validateStoryboardSyntax } from "@/features/file-system/storyboard-syntax"
import { getPendingEditContent } from "@/features/file-system/pending-patch"
import { type PatchOperation, type RefreshOperation } from "@/type"
import { getErrorMessage } from "@/utils/get-error-message"

type RequestFor<Endpoint extends ApiFileSystemRequest["endpoint"]> = Extract<
  ApiFileSystemRequest,
  { endpoint: Endpoint }
>

export async function executeListFiles(
  data: RequestFor<"/files/list">,
  { session }: ToolExecutionOptions,
): Promise<ToolResult> {
  const directory = await session.resolveFileByPathOrId(data.params.filePath)
  if (!directory) return failure(`File ${data.params.filePath} not found`)

  const response = await directory.getDirectChildren()
  if (!response.ok || !response.data) {
    return failure(response.error ?? `Failed to list ${data.params.filePath}`)
  }

  const files = response.data.map((file) => ({
    name: file.name,
    path: toApiPath(file.path),
    kind: file.isDirectory ? "directory" : "file",
    type: file.type,
    format: file.format,
    ...(file.isSkillFile ? { status: file.metadata?.status } : {}),
  }))
  return success(JSON.stringify(files, null, 2))
}

export async function executeFileExists(
  data: RequestFor<"/files/exists">,
  { session }: ToolExecutionOptions,
): Promise<ToolResult> {
  const file = await session.resolveFileByPathOrId(data.params.filePath)
  return success(
    JSON.stringify({
      exists: Boolean(file),
      path: data.params.filePath,
      ...(file
        ? { kind: file.isDirectory ? "directory" : "file", id: file.id }
        : {}),
    }),
  )
}

export async function executeReadFile(
  data: RequestFor<"/files/read">,
  { session }: ToolExecutionOptions,
): Promise<ToolResult> {
  const file = await session.resolveFileByPathOrId(data.params.filePath)
  if (!file) return failure(`File ${data.params.filePath} not found`)
  if (file.isDirectory) {
    return failure("Cannot read a directory. Only files can be read.")
  }

  const response = await file.getFileContent()
  if (!response.ok || !response.data) {
    return failure(response.error ?? "Failed to read file content")
  }
  return success(formatFileContent(response.data))
}

export async function executeDescribeFile(
  data: RequestFor<"/files/describe">,
  { session }: ToolExecutionOptions,
): Promise<ToolResult> {
  const file = await session.resolveFileByPathOrId(data.params.filePath)
  if (!file) return failure(`File ${data.params.filePath} not found`)

  const response = await file.describe()
  if (!response.ok || !response.data) {
    return failure(
      response.error ?? `Failed to describe ${data.params.filePath}`,
    )
  }
  return success(JSON.stringify(response.data, null, 2))
}

export async function executeFindFiles(
  data: RequestFor<"/files/find">,
  { session }: ToolExecutionOptions,
): Promise<ToolResult> {
  const { name, type, format, limit } = data.params
  let files

  if (name) {
    files = await fileSystemRepo.searchFileNodesByName(
      session.projectId,
      name,
      limit,
      { type, format },
    )
  } else if (type) {
    files = await fileSystemRepo.searchFileNodesByType(
      session.projectId,
      type,
      limit,
    )
  } else {
    files = await fileSystemRepo.searchFileNodesByFormat(
      session.projectId,
      format!,
      limit,
    )
  }

  return success(
    JSON.stringify(
      files.map((file) => ({
        name: file.name,
        path: toApiPath(file.path),
        kind: file.directory ? "directory" : "file",
        type: file.type,
        format: file.format,
      })),
      null,
      2,
    ),
  )
}

export async function executeSearchFiles(
  data: RequestFor<"/files/search">,
  { session }: ToolExecutionOptions,
): Promise<ToolResult> {
  const hits = await fileSystemRepo.searchProjectChunksByKeyword(
    session.projectId,
    data.params.query,
  )
  if (hits.length === 0) {
    return failure(`No matches found for "${data.params.query}"`)
  }
  return success(formatKeywordChunkResults(hits))
}

export async function executeFileSyntax(
  data: RequestFor<"/files/syntax">,
  _options: ToolExecutionOptions,
): Promise<ToolResult> {
  const path = `/system/syntax/${data.params.fileType}`
  const syntax = SYSTEM_LEVEL_FILES[path]
  if (!syntax)
    return failure(`No syntax reference found for ${data.params.fileType}`)
  return success(syntax.content)
}

export async function executeCreateFile(
  data: RequestFor<"/files/create">,
  { session }: ToolExecutionOptions,
): Promise<ToolResult> {
  const {
    parentDirectoryPath,
    name,
    dir,
    type,
    format,
    insertMode,
    anchorFilePath,
  } = data.body

  try {
    const parent = await session.resolveFileByPathOrId(parentDirectoryPath)
    if (!parent)
      return failure(`Parent directory ${parentDirectoryPath} not found`)
    if (!parent.isDirectory) {
      return failure(`Parent path "${parentDirectoryPath}" is not a directory`)
    }

    const anchorId = await resolveAnchorId(anchorFilePath, session)
    if (typeof anchorId === "string" && anchorId.startsWith("ERROR:")) {
      return failure(anchorId.slice("ERROR:".length))
    }

    const normalizedName = normalizeAndValidateName(name)
    const file = await fileSystemRepo.createFileWithContentAtPosition(
      session.projectId,
      {
        projectId: session.projectId,
        parentId: parent.id,
        name: normalizedName,
        directory: dir,
        position: 0,
        editable: true,
        type,
        format,
      },
      anchorId,
      insertMode,
    )
    if (!file) {
      return failure(`Failed to create "${name}" in "${parentDirectoryPath}"`)
    }

    return success(
      `Created ${dir ? "directory" : "file"} "${normalizedName}" successfully.`,
      [refresh(parent)],
    )
  } catch (error) {
    return failure(
      getErrorMessage(
        error,
        `Failed to create "${name}" in "${parentDirectoryPath}"`,
      ),
    )
  }
}

export async function executeWriteFile(
  data: RequestFor<"/files/write">,
  { session }: ToolExecutionOptions,
): Promise<ToolResult> {
  const { filePath, content, strategy } = data.body
  const file = await session.resolveFileByPathOrId(filePath)
  if (!file) return failure(`File ${filePath} not found`)

  const editable = validateEditableMarkdownFile(file)
  if (editable) return editable

  return session.withFileEdit(file.id, async () => {
    const pending = await fileSystemRepo.getPendingFileOperation(file.id)
    if (pending?.diffApplied) file.clearFileContentCache()

    const response = await file.getFileContent()
    if (!response.ok || !response.data || response.data.type !== "markdown") {
      return failure(response.error ?? "File content is not editable markdown")
    }

    const current = getPendingEditContent(response.data.data, pending)
    const next = strategy === "append" ? `${current}\n${content}` : content
    const syntaxError = rejectInvalidStoryboardSyntax(file.type, next)
    if (syntaxError) return syntaxError

    const operation: PatchOperation = {
      type: "patch",
      fileId: file.id,
      fileName: file.name,
      baseContent: current,
      content: next,
    }
    await fileSystemRepo.upsertPendingFileOperation(
      session.projectId,
      file.id,
      operation,
    )
    file.updateFileContentCache({ type: "markdown", data: next })
    return success(pendingEditMessage("written"), [operation])
  })
}

export async function executePatchFile(
  data: RequestFor<"/files/patch">,
  { session }: ToolExecutionOptions,
): Promise<ToolResult> {
  const { filePath, oldText, newText, replaceAll } = data.body
  const file = await session.resolveFileByPathOrId(filePath)
  if (!file) return failure(`File ${filePath} not found`)

  const editable = validateEditableMarkdownFile(file)
  if (editable) return editable

  return session.withFileEdit(file.id, async () => {
    const pending = await fileSystemRepo.getPendingFileOperation(file.id)
    if (pending?.diffApplied) file.clearFileContentCache()

    const response = await file.getFileContent()
    if (!response.ok || !response.data || response.data.type !== "markdown") {
      return failure(response.error ?? "File content is not editable markdown")
    }

    const current = getPendingEditContent(response.data.data, pending)
    if (!oldText || !current.includes(oldText)) {
      return failure(`Text to replace was not found in ${filePath}`)
    }

    const next = replaceAll
      ? current.replaceAll(oldText, newText)
      : current.replace(oldText, newText)
    const syntaxError = rejectInvalidStoryboardSyntax(file.type, next)
    if (syntaxError) return syntaxError

    const operation: PatchOperation = {
      type: "patch",
      fileId: file.id,
      fileName: file.name,
      baseContent: current,
      content: next,
    }
    await fileSystemRepo.upsertPendingFileOperation(
      session.projectId,
      file.id,
      operation,
    )
    file.updateFileContentCache({ type: "markdown", data: next })
    return success(pendingEditMessage("patched"), [operation])
  })
}

export async function executeDeleteFile(
  data: RequestFor<"/files/delete">,
  { session }: ToolExecutionOptions,
): Promise<ToolResult> {
  const file = await session.resolveFileByPathOrId(data.params.filePath)
  if (!file) return failure(`File ${data.params.filePath} not found`)

  const parent = await file.getParent()
  const response = await file.delete()
  if (!response.ok) {
    return failure(response.error ?? `Failed to delete ${data.params.filePath}`)
  }
  await session.removeFileFromCache(data.params.filePath)

  return success(
    `Deleted ${data.params.filePath} successfully.`,
    parent ? [refresh(parent)] : undefined,
  )
}

export async function executeMoveFile(
  data: RequestFor<"/files/move">,
  { session }: ToolExecutionOptions,
): Promise<ToolResult> {
  const { filePath, newParentPath, newName, insertMode, anchorFilePath } =
    data.body
  const file = await session.resolveFileByPathOrId(filePath)
  if (!file) return failure(`File ${filePath} not found`)
  if (file.isRoot) return failure("Cannot move the root directory")

  const parent = await session.resolveFileByPathOrId(newParentPath)
  if (!parent) return failure(`New parent ${newParentPath} not found`)
  if (!parent.isDirectory)
    return failure(`New parent ${newParentPath} is not a directory`)

  const anchorId = await resolveAnchorId(anchorFilePath, session)
  if (typeof anchorId === "string" && anchorId.startsWith("ERROR:")) {
    return failure(anchorId.slice("ERROR:".length))
  }

  const previousParent = await file.getParent()
  const response = await file.moveTo(parent, insertMode, anchorId, newName)
  if (!response.ok) {
    return failure(response.error ?? `Failed to move ${filePath}`)
  }

  return success(`Moved ${filePath} successfully.`, [
    ...(previousParent ? [refresh(previousParent)] : []),
    refresh(parent),
  ])
}

export async function executeCopyFile(
  data: RequestFor<"/files/copy">,
  { session }: ToolExecutionOptions,
): Promise<ToolResult> {
  const source = await session.resolveFileByPathOrId(data.body.fromFilePath)
  if (!source) return failure(`Source file ${data.body.fromFilePath} not found`)

  const target = await session.resolveFileByPathOrId(data.body.toFilePath)
  if (!target) return failure(`Target file ${data.body.toFilePath} not found`)

  const response = await source.copyTo(target)
  if (!response.ok) {
    return failure(response.error ?? "Failed to copy file content")
  }
  return success(`Copied ${data.body.fromFilePath} successfully.`, [
    refresh(source),
    refresh(target),
  ])
}

export async function executeRenameFile(
  data: RequestFor<"/files/rename">,
  { session }: ToolExecutionOptions,
): Promise<ToolResult> {
  const file = await session.resolveFileByPathOrId(data.body.filePath)
  if (!file) return failure(`File ${data.body.filePath} not found`)

  const response = await file.rename(data.body.newName)
  if (!response.ok) {
    return failure(
      response.error ??
        `Failed to rename ${data.body.filePath} to ${data.body.newName}`,
    )
  }
  return success(`Renamed ${data.body.filePath} successfully.`, [refresh(file)])
}

function formatFileContent(data: FileContentPayload): string {
  switch (data.type) {
    case "markdown":
      return data.data
    case "video-editor":
    case "json":
      return JSON.stringify(data.data, null, 2)
    case "asset": {
      const payload = {
        type: data.data.type,
        id: data.data.id,
        url: data.data.url,
        source: data.data.source,
      }
      const message = `This is an asset. Here is its details:\n ${JSON.stringify(payload, null, 2)}`
      return message
    }
    default:
      return "This file cannot be read."
  }
}

function normalizeAndValidateName(name: string) {
  const normalizedName = normalizeFileName(name)
  if (!normalizedName) throw new Error("Invalid file name")
  return normalizedName
}

async function resolveAnchorId(
  anchorFilePath: string | undefined,
  session: ToolExecutionOptions["session"],
): Promise<string | null> {
  if (!anchorFilePath) return null
  const anchor = await session.resolveFileByPathOrId(anchorFilePath)
  return anchor ? anchor.id : `ERROR:Anchor file ${anchorFilePath} not found`
}

function validateEditableMarkdownFile(file: {
  isDirectory: boolean
  type: FileType | null
  format: FileFormat | null
}): ToolResult | null {
  if (file.isDirectory) return failure("Cannot edit a directory")
  if (!isMarkdownEditable(file.type, file.format)) {
    return failure(
      "Only markdown document, skill, and storyboard files can be edited",
    )
  }
  return null
}

function rejectInvalidStoryboardSyntax(
  type: string | null,
  content: string,
): ToolResult | null {
  if (type !== fileType.STORYBOARD) return null
  const result = validateStoryboardSyntax(content)
  return result.ok
    ? null
    : failure(result.error ?? "Storyboard syntax is invalid")
}

function refresh(file: { id: string; name: string }): RefreshOperation {
  return { type: "refresh", fileId: file.id, fileName: file.name }
}

function pendingEditMessage(action: "written" | "patched") {
  return `Content ${action} and sent to the user for approval. The user will see the change and can approve or reject it. Do not repeat the content in your response.`
}
