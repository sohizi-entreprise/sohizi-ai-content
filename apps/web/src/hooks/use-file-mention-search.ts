import { useCallback } from "react"
import { useMentionSearch } from "./use-mention-search"
import { searchFilesByNameQueryOptions } from "@/features/chat/query-mutation"
import { searchFilesByName } from "@/features/projects/request"

export type FileMentionItem = {
  id: string
  display: string
  path: string
  format: string
}

export function useFileMentionSearch(projectId: string) {
  const search = useMentionSearch<FileMentionItem>(
    useCallback(
      async (
        query: string,
        options?: { signal?: AbortSignal },
      ): Promise<Array<FileMentionItem>> => {
        const files = await searchFilesByName(projectId, query, 15, {
          signal: options?.signal,
        })

        return files
          .filter((file) => !file.directory && Boolean(file.path))
          .map((file) => ({
            id: file.id,
            display: file.name,
            path: file.path,
            format: file.format ?? "markdown",
          }))
      },
      [projectId],
    ),
    useCallback(
      (query: string) => searchFilesByNameQueryOptions(projectId, query),
      [projectId],
    ),
  )

  return search
}
