import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useDebouncedValue } from './use-debounced-value'
import type { FileNode } from '@/features/projects/type'
import { searchFilesByName } from '@/features/projects/request'

export function useFolderSearch(projectId: string, enabled = true) {
  const [folderQuery, setFolderQuery] = useState('')
  const trimmedFolderQuery = folderQuery.trim()
  const trimmedDebouncedFolderQuery = useDebouncedValue(trimmedFolderQuery, 250)

  const { data: searchedFiles, isFetching: isSearchingFolders } = useQuery({
    queryKey: [
      'project',
      projectId,
      'folder-search',
      trimmedDebouncedFolderQuery,
    ],
    queryFn: ({ signal }) =>
      searchFilesByName(projectId, trimmedDebouncedFolderQuery, 25, {
        signal,
        directory: true,
      }),
    enabled: enabled && trimmedDebouncedFolderQuery.length > 0,
    staleTime: 1000 * 60,
  })

  const folderOptions = useMemo<Array<FileNode>>(
    () => searchedFiles ?? [],
    [searchedFiles],
  )

  return {
    folderQuery,
    setFolderQuery,
    trimmedDebouncedFolderQuery,
    folderOptions,
    isSearchingFolders,
  }
}
