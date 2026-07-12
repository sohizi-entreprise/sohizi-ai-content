import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { searchFilesByNameQueryOptions } from '@/features/chat/query-mutation'
import { searchFilesByName } from '@/features/projects/request'

export type FileMentionItem = {
  id: string
  display: string
  format: string
}

export function useFileMentionSearch(projectId: string) {
  const queryClient = useQueryClient()

  const search = useCallback(
    async (
      query: string,
      options?: { signal?: AbortSignal },
    ): Promise<FileMentionItem[]> => {
      const trimmed = query.trim()
      if (!trimmed) return []

      const files = await queryClient.fetchQuery({
        ...searchFilesByNameQueryOptions(projectId, trimmed),
        queryFn: () =>
          searchFilesByName(projectId, trimmed, 15, {
            signal: options?.signal,
          }),
        staleTime: 1000 * 60,
      })

      return files
        .filter((file) => !file.directory)
        .map((file) => ({
          id: file.id,
          display: file.name,
          format: file.format ?? 'markdown',
        }))
    },
    [projectId, queryClient],
  )

  return search
}
