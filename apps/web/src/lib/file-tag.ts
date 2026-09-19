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

const FILE_TAG_PATTERN = /^\[([^\]]+)\]\((\/root(?:\/[^)\s]+)?)\)$/

export function toProjectFilePath(
  href: string | null | undefined,
): string | null {
  if (!href) return null

  const trimmed = href.trim()
  const pathname = extractPathname(trimmed)
  if (!pathname) return null
  if (pathname === "/root" || pathname.startsWith("/root/")) {
    return pathname
  }
  return null
}

export function isProjectFilePath(
  href: string | null | undefined,
): href is string {
  return toProjectFilePath(href) !== null
}

function extractPathname(href: string): string | null {
  if (href.startsWith("/")) {
    return href.split(/[?#]/, 1)[0] ?? null
  }

  try {
    return new URL(href).pathname
  } catch {
    try {
      return new URL(href, "http://local.invalid").pathname
    } catch {
      return null
    }
  }
}

export function formatFileTag({ displayName, path }: FileTagParams): string {
  return `[${displayName}](${path})`
}

export function parseFileTag(raw: string): FileTagParams | null {
  const match = FILE_TAG_PATTERN.exec(raw.trim())
  if (!match) return null

  return {
    displayName: match[1],
    path: match[2],
  }
}
