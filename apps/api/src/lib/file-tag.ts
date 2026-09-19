/**
 * Universal file tagging syntax used across editors and chat:
 *
 *   [Display Name](/root/path/to/file)
 */

export type FileTagParams = {
  displayName: string
  path: string
}

/** Matches a complete file tag (global). */
export const FILE_TAG_REGEX = /\[([^\]]+)\]\((\/root(?:\/[^)\s]+)?)\)/g

export function formatFileTag({ displayName, path }: FileTagParams): string {
  return `[${displayName}](${path})`
}
