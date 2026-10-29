import { FileNode, FileNodeContent } from "@/db/schema"
import { fileFormat } from "./constants"

export const normalizeFileName = (name: string) => {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\W\s]+/g, "-")
}

/** A file's final extension is part of one ltree label, never a path separator. */
export function normalizeFileNodeName(
  name: string,
  directory: boolean,
): string {
  const trimmed = name.trim()
  if (directory) return normalizeFileName(trimmed)
  const dot = trimmed.lastIndexOf(".")
  if (dot <= 0 || dot === trimmed.length - 1) return normalizeFileName(trimmed)
  const stem = normalizeFileName(trimmed.slice(0, dot))
  const extension = normalizeFileName(trimmed.slice(dot + 1))
  return stem && extension ? `${stem}_${extension}` : normalizeFileName(trimmed)
}

export function fileNodePathCandidates(parts: string[]): string[] {
  return [
    ...new Set([
      parts.join("."),
      parts
        .map((part, index) =>
          index === parts.length - 1
            ? normalizeFileNodeName(part, false)
            : normalizeFileName(part),
        )
        .join("."),
      parts.map((part) => normalizeFileName(part)).join("."),
    ]),
  ]
}

export function joinLtree(parentPath: string | null | undefined, name: string) {
  if (!parentPath) {
    return name
  }
  return `${parentPath}.${name}`
}

export function parentLtree(path: string) {
  const separatorIndex = path.lastIndexOf(".")
  if (separatorIndex === -1) {
    return null
  }
  return path.slice(0, separatorIndex)
}

export function toApiPath(ltreePath: string) {
  if (!ltreePath) {
    return "/"
  }
  return `/${ltreePath.replaceAll(".", "/")}`
}

export function fromApiPath(apiPath: string) {
  const trimmedPath = apiPath.trim()
  if (
    trimmedPath === "" ||
    trimmedPath === "/" ||
    trimmedPath === "./" ||
    trimmedPath === "."
  ) {
    return null
  }

  let normalizedPath = trimmedPath
  while (normalizedPath.startsWith("./")) {
    normalizedPath = normalizedPath.slice(2)
  }
  while (normalizedPath.startsWith("/")) {
    normalizedPath = normalizedPath.slice(1)
  }

  if (normalizedPath === "") {
    return null
  }

  return normalizedPath.replaceAll("/", ".")
}

export function serializeFileNode<T extends { path: string }>(node: T): T {
  return {
    ...node,
    path: toApiPath(node.path),
  }
}

export function ltreeDepth(path: string) {
  if (!path) {
    return 0
  }
  return path.split(".").length - 1
}

export function serializeFileContent(
  fileNode: FileNode,
  fileContent: FileNodeContent,
) {
  switch (fileNode.format) {
    case fileFormat.JSON:
      return JSON.stringify(fileContent.jsonContent ?? {}, null, 2)
    default:
      return fileContent.content ?? ""
  }
}

export function proseToText(value: unknown): string {
  if (!value || typeof value !== "object") {
    return ""
  }

  const node = value as {
    text?: string
    content?: unknown[]
  }

  const textParts: string[] = []

  if (typeof node.text === "string" && node.text.length > 0) {
    textParts.push(node.text)
  }

  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      const childText = proseToText(child)
      if (childText) {
        textParts.push(childText)
      }
    }
  }

  return textParts.join("\n").trim()
}

export function formatReadOutput(
  text: string,
  offset?: number,
  limit?: number,
) {
  if (offset !== undefined && offset < 1) {
    throw new Error("Offset must be greater than or equal to 1.")
  }
  if (limit !== undefined && limit < 1) {
    throw new Error("Limit must be greater than or equal to 1.")
  }

  if (offset === undefined && limit === undefined) {
    return text
  }

  const lines = text === "" ? [] : text.split(/\r?\n/)
  if (lines.length === 0) {
    return ""
  }

  const start = offset ?? 1
  const end =
    limit === undefined
      ? lines.length
      : Math.min(lines.length, start + limit - 1)

  if (start > lines.length) {
    return ""
  }

  return lines
    .slice(start - 1, end)
    .map((line, index) => `${start + index} | ${line}`)
    .join("\n")
}

export function formatKeywordChunkResults(
  hits: Array<{
    fileNodeId: string
    totalChunksMatched: number
    snippet: string
    path?: string
  }>,
) {
  if (hits.length === 0) {
    return "No matches found."
  }

  return hits
    .map((hit, index) => {
      const location = hit.path ?? `/[fileId: ${hit.fileNodeId}]`
      return [
        `${index + 1}. ${location} [fileId: ${hit.fileNodeId}] (${hit.totalChunksMatched} chunk${hit.totalChunksMatched === 1 ? "" : "s"} matched)`,
        hit.snippet,
      ].join("\n")
    })
    .join("\n---\n")
}

export async function formatChunkResults(
  hits: Array<{
    fileNodeId: string
    chunkIndex: number
    chunkText: string
    path: string
    rank?: number
    distance?: number
  }>,
  scoreKey: "rank" | "distance",
) {
  if (hits.length === 0) {
    return "No matches found."
  }

  return hits
    .map((hit, index) => {
      const score = hit[scoreKey]
      const formattedScore =
        typeof score === "number"
          ? scoreKey === "distance"
            ? score.toFixed(4)
            : score.toFixed(3)
          : "n/a"

      return [
        `${index + 1}. ${hit.path ?? `/[fileId: ${hit.fileNodeId}]`}`,
        `chunk: ${hit.chunkIndex}`,
        `${scoreKey}: ${formattedScore}`,
        hit.chunkText,
      ].join("\n")
    })
    .join("\n---\n")
}

export function countLines(text: string) {
  if (text === "") {
    return 0
  }
  return text.split(/\r?\n/).length
}

export function countWords(text: string) {
  const trimmed = text.trim()
  if (!trimmed) {
    return 0
  }
  return trimmed.split(/\s+/).length
}
