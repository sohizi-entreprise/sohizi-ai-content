import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getProjectQueryOptions } from '@/features/projects/query-mutation'
import { useFileTreeStore } from '@/features/editor/stores/file-tree-store'

/**
 * The asset library and media uploads read the project root folder from the
 * file tree store, which only the main editor route populates. The standalone
 * video editor page seeds it here so both work outside that route.
 */
export function useProjectFileTreeInit(projectId: string) {
  const init = useFileTreeStore((s) => s.init)
  const initializedProjectId = useFileTreeStore((s) => s.projectId)

  const { data } = useQuery({
    ...getProjectQueryOptions(projectId),
    enabled: !!projectId && initializedProjectId !== projectId,
  })

  useEffect(() => {
    if (!data) return
    init(projectId, data.rootFolderId, data.project)
  }, [data, init, projectId])
}
