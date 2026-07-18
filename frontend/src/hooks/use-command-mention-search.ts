import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { searchCommandsQueryOptions } from '@/features/chat/query-mutation'
import { searchCommands } from '@/features/projects/request'

export type CommandMentionItem = {
  id: string
  name: string
  display: string
}

export function useCommandMentionSearch(projectId: string) {
  const queryClient = useQueryClient()

  const search = useCallback(
    async (
      query: string,
      options?: { signal?: AbortSignal },
    ): Promise<CommandMentionItem[]> => {
      const trimmed = query.trim()
      if (!trimmed) return []

      const commands = await queryClient.fetchQuery({
        ...searchCommandsQueryOptions(projectId, trimmed),
        queryFn: () =>
          searchCommands(projectId, trimmed, 15, {
            signal: options?.signal,
          }),
        staleTime: 1000 * 60,
      })

      return commands.map((command) => ({
        id: command.id,
        name: command.name,
        display: command.name,
      }))
    },
    [projectId, queryClient],
  )

  return search
}
