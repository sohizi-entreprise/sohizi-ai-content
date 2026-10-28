import { useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { getProjectOptionsQueryOptions } from "@/features/projects/query-mutation"

export type CommandMentionItem = {
  id: string
  name: string
  display: string
}

export function useCommandMentionSearch(_projectId: string) {
  const queryClient = useQueryClient()

  return useCallback(
    async (query: string): Promise<Array<CommandMentionItem>> => {
      const options = await queryClient.fetchQuery(
        getProjectOptionsQueryOptions("project"),
      )
      const trimmed = query.trim().toLowerCase()
      const commands = options.commands

      const filtered = trimmed
        ? commands.filter(
            (command) =>
              command.name.toLowerCase().includes(trimmed) ||
              command.id.toLowerCase().includes(trimmed),
          )
        : commands

      return filtered.map((command) => ({
        id: command.id,
        name: command.id,
        display: command.name,
      }))
    },
    [queryClient],
  )
}
