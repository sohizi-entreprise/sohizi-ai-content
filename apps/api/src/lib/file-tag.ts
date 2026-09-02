/**
 * Universal file tagging syntax used across editors and chat:
 *
 *   @[Display Name](file:FILE_ID?format=FORMAT)
 *   @[Display Name](file:FILE_ID?format=FORMAT&lines=L2-L5)
 *
 * `lines` is optional (chat citations). `snippet` is legacy and still parsed
 * from older messages, but new citations do not include it.
 */

export type FileTagParams = {
  displayName: string
  fileId: string
  format: string
  lines?: string | null
  snippet?: string | null
}

/** Matches a complete file tag (global). */
export const FILE_TAG_REGEX = /@\[([^\]]+)\]\(file:([^?)\s]+)\?([^)]+)\)/g

export function formatFileTag({
  displayName,
  fileId,
  format,
  lines,
  snippet,
}: FileTagParams): string {
  const params = new URLSearchParams()
  params.set('format', format)
  if (lines) params.set('lines', lines)
  if (snippet) params.set('snippet', snippet)
  return `@[${displayName}](file:${fileId}?${params.toString()})`
}
