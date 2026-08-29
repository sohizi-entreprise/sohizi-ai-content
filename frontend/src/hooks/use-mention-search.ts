import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { FetchQueryOptions } from '@tanstack/react-query'

export function useMentionSearch<TItem>(
  fetchItems: (
    query: string,
    options?: { signal?: AbortSignal },
  ) => Promise<Array<TItem>>,
  getQueryOptions: (query: string) => FetchQueryOptions<Array<TItem>>,
) {
  const queryClient = useQueryClient()

  return useCallback(
    async (
      query: string,
      options?: { signal?: AbortSignal },
    ): Promise<Array<TItem>> => {
      const trimmed = query.trim()
      if (!trimmed) return []

      return queryClient.fetchQuery({
        ...getQueryOptions(trimmed),
        queryFn: () => fetchItems(trimmed, options),
        staleTime: 1000 * 60,
      })
    },
    [fetchItems, getQueryOptions, queryClient],
  )
}
