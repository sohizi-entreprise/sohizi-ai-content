import { useCallback } from "react"
import { useMentionSearch } from "./use-mention-search"
import { searchCommandsQueryOptions } from "@/features/chat/query-mutation"
import { searchCommands } from "@/features/projects/request"

export type CommandMentionItem = {
  id: string
  name: string
  display: string
}

export function useCommandMentionSearch(projectId: string) {
  return useMentionSearch(
    useCallback(
      async (query: string, options?: { signal?: AbortSignal }) => {
        const commands = await searchCommands(projectId, query, 15, {
          signal: options?.signal,
        })

        return commands.map((command) => ({
          id: command.id,
          name: command.name,
          display: command.name,
        }))
      },
      [projectId],
    ),
    useCallback(
      (query: string) => searchCommandsQueryOptions(projectId, query),
      [projectId],
    ),
  )
}
