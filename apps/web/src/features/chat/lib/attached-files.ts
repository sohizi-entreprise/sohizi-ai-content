import type { AttachedFile } from "@/components/widgets/file-attachments"
import type {
  AvailableChatFile,
  ChatAttachmentKind,
  FilePart,
  ImagePart,
  LoadedChatFile,
} from "../types"
import { cleanMediaType } from "@/utils/clean-mediaType"

const EXTENSION_KIND: Record<string, ChatAttachmentKind> = {
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  svg: "image",
  bmp: "image",
  avif: "image",
  heic: "image",
  pdf: "pdf",
  txt: "text",
  text: "text",
  mp4: "video",
  webm: "video",
  mov: "video",
  mkv: "video",
  avi: "video",
  mp3: "audio",
  wav: "audio",
  ogg: "audio",
  m4a: "audio",
  aac: "audio",
  flac: "audio",
}

function kindFromMime(mime: string): ChatAttachmentKind | null {
  if (mime.startsWith("image/") || mime === "image") return "image"
  if (mime === "application/pdf" || mime === "pdf") return "pdf"
  if (mime === "text/plain") return "text"
  if (mime.startsWith("video/") || mime === "video") return "video"
  if (mime.startsWith("audio/") || mime === "audio") return "audio"
  return null
}

function kindFromExtension(url: string): ChatAttachmentKind | null {
  const ext = url.split("?")[0]?.split(".").pop()?.toLowerCase()
  if (!ext) return null
  return EXTENSION_KIND[ext] ?? null
}

function classify(mime: string, url: string): ChatAttachmentKind {
  return (
    kindFromMime(mime) ??
    kindFromMime(cleanMediaType(mime, url)) ??
    kindFromExtension(url) ??
    "file"
  )
}

function isLoadedKind(kind: ChatAttachmentKind): boolean {
  return kind === "image" || kind === "pdf" || kind === "text"
}

function resolvedMediaType(
  mime: string,
  url: string,
  kind: ChatAttachmentKind,
): string {
  if (kind === "pdf") return "application/pdf"
  if (kind === "text") return "text/plain"
  if (
    mime.startsWith("image/") ||
    mime.startsWith("video/") ||
    mime.startsWith("audio/")
  ) {
    return mime
  }
  if (kind === "image" || kind === "video" || kind === "audio") {
    return cleanMediaType(kind, url)
  }
  return mime || cleanMediaType(mime, url)
}

export function partitionAttachedFiles(attachedFiles: Array<AttachedFile>): {
  loadedFiles: Array<LoadedChatFile>
  availableFiles: Array<AvailableChatFile>
} {
  const loadedFiles: Array<LoadedChatFile> = []
  const availableFiles: Array<AvailableChatFile> = []
  let userIndex = 1

  for (const file of attachedFiles) {
    if (file.status !== "uploaded") continue
    const type = classify(file.type, file.url)
    // The user message starts with text at part 0, then one part per uploaded file.
    const messagePartIndex = userIndex
    const entry = {
      userIndex,
      type,
      mediaType: resolvedMediaType(file.type, file.url, type),
      url: file.url,
    }
    userIndex += 1
    if (isLoadedKind(type)) {
      loadedFiles.push({ ...entry, messagePartIndex })
    } else {
      availableFiles.push(entry)
    }
  }

  return { loadedFiles, availableFiles }
}

export function buildUserFileParts(
  attachedFiles: Array<AttachedFile>,
): Array<ImagePart | FilePart> {
  const parts: Array<ImagePart | FilePart> = []
  for (const file of attachedFiles) {
    if (file.status !== "uploaded") continue
    const type = classify(file.type, file.url)
    const mediaType = resolvedMediaType(file.type, file.url, type)
    if (type === "image") {
      parts.push({ type: "image", image: new URL(file.url) })
      continue
    }
    parts.push({
      type: "file",
      data: new URL(file.url),
      mediaType,
    })
  }
  return parts
}
