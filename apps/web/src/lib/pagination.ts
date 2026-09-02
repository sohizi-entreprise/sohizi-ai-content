export type CursorPaginationOptions = {
  cursor?: string
  limit?: number
}

export type CursorPaginationResult<T> = {
  data: Array<T>
  nextCursor: string | null
  hasMore: boolean
}

export type PaginatedResponse<T> = CursorPaginationResult<T>
