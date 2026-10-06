export const DIRECTORY_CHILDREN_PAGE_SIZE = 48

export type DirectoryChildCursor = {
  position: number
  id: string
}

export function encodeDirectoryChildCursor(cursor: DirectoryChildCursor) {
  return `${cursor.position}:${cursor.id}`
}

export function decodeDirectoryChildCursor(
  cursor: string,
): DirectoryChildCursor | null {
  const separator = cursor.indexOf(":")
  if (separator <= 0) return null

  const position = Number(cursor.slice(0, separator))
  const id = cursor.slice(separator + 1)
  if (!Number.isInteger(position) || id.length === 0) return null

  return { position, id }
}

export function previewUrlForChild(
  type: string | null | undefined,
  url: string | null | undefined,
) {
  if (type !== "image" && type !== "video") return null
  return url ?? null
}

export function sliceDirectoryChildrenPage<
  T extends { position: number; id: string },
>(rows: Array<T>, limit: number) {
  const hasMore = rows.length > limit
  const data = hasMore ? rows.slice(0, limit) : rows
  const last = data[data.length - 1]

  return {
    data,
    hasMore,
    nextCursor:
      hasMore && last
        ? encodeDirectoryChildCursor({ position: last.position, id: last.id })
        : null,
  }
}
