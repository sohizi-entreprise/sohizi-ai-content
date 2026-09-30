import {
  fileFormat,
  fileType,
  type FileFormat,
  type FileType,
} from "./constants"

export type LegacyFileFormat =
  | "markdown"
  | "json"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "html"
  | "video-editor"
  | "ai-generated"
  | "skill"
  | "storyboard"

export function defaultFormatForType(type: FileType): FileFormat {
  switch (type) {
    case fileType.SKILL:
    case fileType.STORYBOARD:
    case fileType.DOCUMENT:
      return fileFormat.MARKDOWN
    case fileType.IMAGE:
    case fileType.VIDEO:
    case fileType.AUDIO:
      return fileFormat.FILE
    case fileType.VIDEO_EDITOR:
      return fileFormat.JSON
  }
}

export function classifyFileKindFromContentType(contentType: string): {
  type: FileType
  format: FileFormat
} {
  if (contentType.startsWith("image/")) {
    return { type: fileType.IMAGE, format: fileFormat.FILE }
  }
  if (contentType.startsWith("video/")) {
    return { type: fileType.VIDEO, format: fileFormat.FILE }
  }
  if (contentType.startsWith("audio/")) {
    return { type: fileType.AUDIO, format: fileFormat.FILE }
  }
  if (contentType === "text/html" || contentType.startsWith("text/html")) {
    return { type: fileType.DOCUMENT, format: fileFormat.HTML }
  }
  if (contentType === "application/pdf") {
    return { type: fileType.DOCUMENT, format: fileFormat.PDF }
  }
  return { type: fileType.DOCUMENT, format: fileFormat.FILE }
}

export function classifyFileKindFromAsset(
  assetType: "image" | "video" | "audio" | "document" | "html",
  contentType?: string,
): { type: FileType; format: FileFormat } {
  if (
    assetType === "image" ||
    assetType === "video" ||
    assetType === "audio"
  ) {
    return { type: assetType, format: fileFormat.FILE }
  }
  if (assetType === "html") {
    return { type: fileType.DOCUMENT, format: fileFormat.HTML }
  }
  if (contentType === "application/pdf") {
    return { type: fileType.DOCUMENT, format: fileFormat.PDF }
  }
  return { type: fileType.DOCUMENT, format: fileFormat.FILE }
}

export function migrateLegacyFormat(
  legacyFormat: string | null | undefined,
  contentType?: string,
): { type: FileType | null; format: FileFormat | null } {
  if (!legacyFormat) {
    return { type: null, format: null }
  }

  switch (legacyFormat as LegacyFileFormat) {
    case "markdown":
      return { type: fileType.DOCUMENT, format: fileFormat.MARKDOWN }
    case "json":
      return { type: fileType.DOCUMENT, format: fileFormat.JSON }
    case "skill":
      return { type: fileType.SKILL, format: fileFormat.MARKDOWN }
    case "storyboard":
      return { type: fileType.STORYBOARD, format: fileFormat.MARKDOWN }
    case "image":
      return { type: fileType.IMAGE, format: fileFormat.FILE }
    case "video":
      return { type: fileType.VIDEO, format: fileFormat.FILE }
    case "audio":
      return { type: fileType.AUDIO, format: fileFormat.FILE }
    case "html":
      return { type: fileType.DOCUMENT, format: fileFormat.HTML }
    case "document":
      return {
        type: fileType.DOCUMENT,
        format:
          contentType === "application/pdf"
            ? fileFormat.PDF
            : fileFormat.FILE,
      }
    case "video-editor":
      return { type: fileType.VIDEO_EDITOR, format: fileFormat.JSON }
    case "ai-generated":
      return { type: fileType.DOCUMENT, format: fileFormat.JSON }
    default:
      return { type: fileType.DOCUMENT, format: fileFormat.MARKDOWN }
  }
}

export function resolveCreatedFileKind(input: {
  directory: boolean
  type?: FileType | null
  format?: FileFormat | null
}): { type: FileType | null; format: FileFormat | null } {
  if (input.directory) {
    return { type: null, format: null }
  }
  const type = input.type ?? fileType.DOCUMENT
  const format = input.format ?? defaultFormatForType(type)
  return { type, format }
}

export function isMarkdownEditable(
  type: FileType | null | undefined,
  format: FileFormat | null | undefined,
): boolean {
  if (!type || format !== fileFormat.MARKDOWN) return false
  return (
    type === fileType.DOCUMENT ||
    type === fileType.STORYBOARD ||
    type === fileType.SKILL
  )
}

export function isAssetFileKind(
  type: FileType | null | undefined,
  format: FileFormat | null | undefined,
): boolean {
  if (!type) return false
  if (
    type === fileType.IMAGE ||
    type === fileType.VIDEO ||
    type === fileType.AUDIO
  ) {
    return true
  }
  return (
    type === fileType.DOCUMENT &&
    (format === fileFormat.FILE ||
      format === fileFormat.PDF ||
      format === fileFormat.HTML)
  )
}
