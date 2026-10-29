import { FileNode, FileNodeContent, VideoComposition, Asset } from "@/db/schema"
import { ProseDocument } from "@/type"
import {
  deleteFileNode as deleteFileNodeFn,
  getFileContent as getFileContentFn,
  listDirectoryFiles as listDirectoryFilesFn,
  searchProjectContent as searchProjectContentFn,
  updateFileContent as updateFileContentFn,
  updateFileNode as updateFileNodeFn,
} from "../functions"
import { FileNodeInsertPosition } from "../payload"
import { KeywordChunkHit } from "../types"
import {
  countLines,
  countWords,
  normalizeFileNodeName,
  serializeFileContent,
} from "../utils"
import * as fileSystemRepo from "../repo"
import {
  fileFormat,
  fileType,
  type FileFormat,
  type FileType,
} from "../constants"
import { getCompositionByFileNodeId } from "@/features/video-editor/repo"
import { getAssetByFileNodeId } from "@/features/media-engine/repo"
import { getErrorMessage } from "@/utils/get-error-message"
import { ingestFileContentChunks } from "../ingest-file-content-chunks"

type FileObjectResponse<T> = {
  ok: boolean
  data: T
  error?: string
}

export type FileContentPayload =
  | {
      type: "markdown"
      data: string
    }
  | {
      type: "asset"
      data: Asset
    }
  | {
      type: "video-editor"
      data: VideoComposition
    }
  | {
      type: "json"
      data: Record<string, unknown>
    }

function ok<T>(data: T): FileObjectResponse<T> {
  return {
    ok: true,
    data,
  }
}

function err(error: string): FileObjectResponse<null> {
  return {
    ok: false,
    error,
    data: null,
  }
}

export class FileObject {
  private fileNode: FileNode
  private fileContentCache: FileContentPayload | undefined

  constructor(fileNode: FileNode) {
    this.fileNode = fileNode
    this.fileContentCache = undefined
  }

  get format() {
    return this.fileNode.format
  }

  get type() {
    return this.fileNode.type
  }

  get path() {
    return this.fileNode.path
  }

  get id() {
    return this.fileNode.id
  }

  get name() {
    return this.fileNode.name
  }

  get isDirectory() {
    return this.fileNode.directory
  }

  get isRoot() {
    return this.fileNode.parentId === null && this.fileNode.directory === true
  }

  get isSkillFolder() {
    return (
      this.fileNode.type === fileType.SKILL && this.fileNode.directory === true
    )
  }

  get isSkillFile() {
    return (
      this.fileNode.type === fileType.SKILL && this.fileNode.directory === false
    )
  }

  get metadata() {
    return this.fileNode.metadata
  }

  async getContent(): Promise<FileObjectResponse<FileNodeContent | null>> {
    if (this.fileNode.directory) {
      return err(`Cannot get content of a directory ${this.fileNode.name}`)
    }

    try {
      const fileContent = await getFileContentFn(
        this.fileNode.projectId,
        this.fileNode.id,
      )
      return ok(fileContent)
    } catch (error) {
      return err(
        getErrorMessage(
          error,
          `Failed to get content of ${this.fileNode.name}`,
        ),
      )
    }
  }

  async getDirectChildren(): Promise<FileObjectResponse<FileObject[] | null>> {
    if (!this.fileNode.directory) {
      return err(`Cannot get children of a file ${this.fileNode.name}`)
    }

    try {
      const children = await listDirectoryFilesFn(
        this.fileNode.projectId,
        this.fileNode.id,
      )
      return ok(children.map((child) => new FileObject(child)))
    } catch (error) {
      return err(
        getErrorMessage(
          error,
          `Failed to get children of ${this.fileNode.name}`,
        ),
      )
    }
  }

  async getParent(): Promise<FileObject | null | undefined> {
    if (!this.fileNode.parentId) {
      return null
    }
    const parent = await fileSystemRepo.getFileNodeById(
      this.fileNode.projectId,
      this.fileNode.parentId,
    )
    if (!parent) {
      return
    }
    return new FileObject(parent)
  }

  async searchByKeyword(
    keyword: string,
    limit = 20,
  ): Promise<FileObjectResponse<KeywordChunkHit[] | null>> {
    const normalizedKeyword = keyword.trim()
    if (!normalizedKeyword) {
      return err("Keyword cannot be empty")
    }

    try {
      const hits = await searchProjectContentFn({
        projectId: this.fileNode.projectId,
        keyword: normalizedKeyword,
        limit,
      })
      return ok(hits)
    } catch (error) {
      return err(getErrorMessage(error, "Failed to search project content"))
    }
  }

  async moveTo(
    newDirectory: FileObject | null,
    position: FileNodeInsertPosition,
    anchorId?: string | null,
    newName?: string,
  ): Promise<FileObjectResponse<string | null>> {
    if (newDirectory && !newDirectory.fileNode.directory) {
      return err(
        `Cannot move file ${this.fileNode.name} into non-directory ${newDirectory.fileNode.name}`,
      )
    }

    try {
      const updatedFileNode = await updateFileNodeFn(this.fileNode.projectId, {
        id: this.fileNode.id,
        ...(newName === undefined ? {} : { name: newName }),
        parentId: newDirectory?.fileNode.id ?? null,
        position,
        ...(anchorId === undefined ? {} : { anchorId }),
      })

      this.fileNode = updatedFileNode
      return ok(
        `File moved to ${newDirectory?.fileNode.name ?? "/"} successfully`,
      )
    } catch (error) {
      return err(
        getErrorMessage(
          error,
          `Failed to move file ${this.fileNode.name} to ${newDirectory?.fileNode.name ?? "/"}`,
        ),
      )
    }
  }

  async rename(
    newName: string,
  ): Promise<FileObjectResponse<FileObject | null>> {
    if (!this.fileNode.editable) {
      return err(`Cannot rename a built-in file ${this.fileNode.name}`)
    }
    const normalizedName = normalizeFileNodeName(
      newName,
      this.fileNode.directory,
    )
    if (!normalizedName) {
      return err("Invalid file name")
    }

    try {
      const updatedFileNode = await updateFileNodeFn(this.fileNode.projectId, {
        id: this.fileNode.id,
        name: normalizedName,
      })

      this.fileNode = updatedFileNode
      return ok(this)
    } catch (error) {
      return err(
        getErrorMessage(error, `Failed to rename file ${this.fileNode.name}`),
      )
    }
  }

  async delete(): Promise<FileObjectResponse<string | null>> {
    if (!this.fileNode.editable) {
      return err(`Cannot delete a built-in file ${this.fileNode.name}`)
    }

    try {
      await deleteFileNodeFn(this.fileNode.projectId, this.fileNode.id)
      return ok(`File ${this.fileNode.name} deleted successfully`)
    } catch (error) {
      return err(
        getErrorMessage(error, `Failed to delete file ${this.fileNode.name}`),
      )
    }
  }

  async copyTo(
    targetFile: FileObject,
  ): Promise<FileObjectResponse<string | null>> {
    if (this.fileNode.directory) {
      return err(`Cannot copy a directory ${this.fileNode.name}`)
    }
    if (this.type === fileType.SKILL) {
      return this.copySkillTo(targetFile)
    }
    const response = await this.getContent()
    if (response.error) {
      return err(response.error)
    }
    const content = response.data
    if (!content) {
      return err(`Invalid content inside the file ${this.fileNode.name}`)
    }

    const writeResponse = await targetFile.writeContent({
      content: content.content ?? "",
      jsonContent: content.jsonContent ?? {},
      proseContent: content.proseContent ?? undefined,
    })

    if (!writeResponse.ok) {
      return err(
        writeResponse.error ??
          `Failed to copy ${this.fileNode.name} to ${targetFile.fileNode.name}`,
      )
    }

    return ok(
      `File ${this.fileNode.name} copied to ${targetFile.fileNode.name} successfully`,
    )
  }

  private async copySkillTo(
    targetFile: FileObject,
  ): Promise<FileObjectResponse<string | null>> {
    const source = await this.loadStoredTextContent()
    if (source.type !== "markdown") {
      return err(
        `Cannot copy ${this.fileNode.name} because its content is not markdown`,
      )
    }
    const markdown = source.data

    if (targetFile.type === fileType.SKILL) {
      const updated = await fileSystemRepo.updateFileContent(
        targetFile.fileNode.projectId,
        targetFile.id,
        { content: markdown },
      )
      if (!updated) {
        return err(
          `Failed to copy ${this.fileNode.name} to ${targetFile.fileNode.name}`,
        )
      }
      await ingestFileContentChunks({
        projectId: targetFile.fileNode.projectId,
        fileNodeId: targetFile.id,
        content: markdown,
      })
      return ok(
        `File ${this.fileNode.name} copied to ${targetFile.fileNode.name} successfully`,
      )
    }

    const writeResponse = await targetFile.writeContent({
      content: markdown,
      jsonContent: {},
    })
    if (!writeResponse.ok) {
      return err(
        writeResponse.error ??
          `Failed to copy ${this.fileNode.name} to ${targetFile.fileNode.name}`,
      )
    }

    return ok(
      `File ${this.fileNode.name} copied to ${targetFile.fileNode.name} successfully`,
    )
  }

  async writeContent(data: {
    content: string
    jsonContent?: Record<string, unknown>
    proseContent?: ProseDocument
  }): Promise<FileObjectResponse<string | null>> {
    if (this.fileNode.directory) {
      return err(`Cannot write content to a directory ${this.fileNode.name}`)
    }

    try {
      await updateFileContentFn(this.fileNode.projectId, this.fileNode.id, data)
      return ok(`Content written to ${this.fileNode.name} successfully`)
    } catch (error) {
      return err(
        getErrorMessage(
          error,
          `Failed to write content to ${this.fileNode.name}`,
        ),
      )
    }
  }

  async patchContent(data: {
    oldText: string
    newText: string
    replaceAll: boolean
  }): Promise<FileObjectResponse<string | null>> {
    if (this.fileNode.directory) {
      return err(`Cannot patch content of a directory ${this.fileNode.name}`)
    }

    try {
      const response = await this.getContent()
      if (!response.ok) {
        return err(
          response.error ?? `Failed to get content of ${this.fileNode.name}`,
        )
      }
      const content = response.data
      if (content === null) {
        return err(`Invalid content inside the file ${this.fileNode.name}`)
      }

      const originalText = content.content ?? ""
      const patchedText = data.replaceAll
        ? originalText.replaceAll(data.oldText, data.newText)
        : originalText.replace(data.oldText, data.newText)

      if (data.oldText !== "" && patchedText === originalText) {
        return err(
          `Text "${data.oldText}" was not found in ${this.fileNode.name}`,
        )
      }

      await updateFileContentFn(this.fileNode.projectId, this.fileNode.id, {
        content: patchedText,
      })

      return ok(`Content patched in ${this.fileNode.name} successfully`)
    } catch (error) {
      return err(
        getErrorMessage(
          error,
          `Failed to patch content in ${this.fileNode.name}`,
        ),
      )
    }
  }

  async stats(): Promise<FileObjectResponse<Record<string, unknown> | null>> {
    if (this.fileNode.directory) {
      const response = await this.getDirectChildren()
      if (response.error) {
        return err(response.error)
      }
      const children = response.data
      return ok({
        type: "directory",
        entries: children?.length ?? 0,
      })
    }
    const response = await this.getContent()
    if (!response.ok) {
      return err(response.error ?? "Failed to get content")
    }
    const content = response.data
    if (!content) {
      return err(`Invalid content inside the file ${this.fileNode.name}`)
    }
    const text = serializeFileContent(this.fileNode, content)
    return ok({
      type: "file",
      fileType: this.fileNode.type ?? "unknown",
      format: this.fileNode.format ?? "unknown",
      lines: countLines(text),
      words: countWords(text),
    })
  }

  async describe(): Promise<
    FileObjectResponse<Record<string, unknown> | null>
  > {
    if (this.fileNode.directory) {
      const response = await this.getDirectChildren()
      if (response.error) {
        return err(response.error)
      }
      const children = response.data
      return ok({
        type: "directory",
        childrenCount: children?.length ?? 0,
        isEditable: this.fileNode.editable,
        lastUpdated: this.fileNode.updatedAt,
        createdAt: this.fileNode.createdAt,
      })
    }
    return ok({
      type: "file",
      fileType: this.fileNode.type ?? "unknown",
      format: this.fileNode.format ?? "unknown",
      isEditable: this.fileNode.editable,
      lastUpdated: this.fileNode.updatedAt,
      createdAt: this.fileNode.createdAt,
    })
  }

  async getFileContent(): Promise<
    FileObjectResponse<FileContentPayload | null>
  > {
    if (this.fileContentCache !== undefined) {
      return ok(this.fileContentCache)
    }
    if (this.isDirectory) {
      return err(`Cannot get content of a directory ${this.fileNode.id}`)
    }
    if (!this.type) {
      return err(`This file type is corrupted. It cannot be read.`)
    }

    const content = await this.loadFileContent(this.type)
    if (content === undefined) {
      return err(`File with type: ${this.fileNode.type} is not yet supported.`)
    }

    if (content === null) {
      return err(
        `Asset record not found for file "${this.fileNode.name}" [Id: ${this.fileNode.id}] [format: ${this.fileNode.format}]. This file node has no associated media asset.`,
      )
    }
    this.fileContentCache = content
    return ok(content)
  }

  private async loadFileContent(
    type: FileType,
  ): Promise<FileContentPayload | null | undefined> {
    switch (type) {
      case fileType.IMAGE:
      case fileType.VIDEO:
      case fileType.AUDIO:
        return this.loadAssetContent()
      case fileType.VIDEO_EDITOR: {
        const composition = await getCompositionByFileNodeId(this.fileNode.id)
        return composition ? { type: "video-editor", data: composition } : null
      }
      case fileType.SKILL: {
        return this.loadStoredTextContent()
      }
      case fileType.STORYBOARD:
      case fileType.DOCUMENT:
        if (
          this.format === fileFormat.FILE ||
          this.format === fileFormat.PDF ||
          this.format === fileFormat.HTML
        ) {
          return this.loadAssetContent()
        }
        return this.loadStoredTextContent()
      default:
        return undefined
    }
  }

  private async loadAssetContent(): Promise<FileContentPayload | null> {
    const asset = await getAssetByFileNodeId(
      this.fileNode.projectId,
      this.fileNode.id,
    )
    return asset ? { type: "asset", data: asset } : null
  }

  private async loadStoredTextContent(): Promise<FileContentPayload> {
    const fileContent = await fileSystemRepo.getFileContentById(
      this.fileNode.projectId,
      this.fileNode.id,
    )
    if (this.format === fileFormat.JSON) {
      return { type: "json", data: fileContent?.jsonContent ?? {} }
    }
    return { type: "markdown", data: fileContent?.content ?? "" }
  }

  updateFileContentCache(content: FileContentPayload | null | undefined): void {
    if (!content) {
      this.fileContentCache = undefined
      return
    }
    if (!isCompatibleContentCacheType(this.type, this.format, content.type)) {
      console.error(
        `Setting cache failed due to type mismatch. Expected: ${this.type}/${this.format}, Got: ${content.type}`,
      )
      return
    }
    this.fileContentCache = content
  }

  clearFileContentCache(): void {
    this.fileContentCache = undefined
  }
}

/**
 * Storyboard files are stored and edited as markdown text, so a `markdown`
 * payload is valid for storyboard files.
 */
export function isCompatibleContentCacheType(
  type: FileType | null | undefined,
  format: FileFormat | null | undefined,
  contentType: FileContentPayload["type"] | undefined,
): boolean {
  if (!type || !contentType) return false
  if (type === fileType.STORYBOARD && contentType === "markdown") return true
  if (
    type === fileType.DOCUMENT &&
    format === fileFormat.MARKDOWN &&
    contentType === "markdown"
  ) {
    return true
  }
  if (
    type === fileType.DOCUMENT &&
    format === fileFormat.JSON &&
    contentType === "json"
  ) {
    return true
  }
  if (type === fileType.SKILL && contentType === "markdown") return true
  if (type === fileType.VIDEO_EDITOR && contentType === "video-editor") {
    return true
  }
  if (
    (type === fileType.IMAGE ||
      type === fileType.VIDEO ||
      type === fileType.AUDIO) &&
    contentType === "asset"
  ) {
    return true
  }
  if (
    type === fileType.DOCUMENT &&
    format === fileFormat.HTML &&
    contentType === "asset"
  ) {
    return true
  }
  if (
    type === fileType.DOCUMENT &&
    (format === fileFormat.PDF || format === fileFormat.FILE) &&
    contentType === "asset"
  ) {
    return true
  }
  return false
}
