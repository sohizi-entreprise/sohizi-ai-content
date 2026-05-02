import { useEffect } from 'react'
import { AppLayout } from './components/layout/app-layout'
import { useQuery } from '@tanstack/react-query'
import { getProjectQueryOptions } from '../projects/query-mutation'
import { useParams } from '@tanstack/react-router'
import { useFileTreeStore } from './stores/file-tree-store'

export function VideoProductionEditor() {
  const { projectId } = useParams({ from: '/dashboard/projects/$projectId/editor' })

  const {data, isLoading} = useQuery(getProjectQueryOptions(projectId))
  const init = useFileTreeStore((s) => s.init)

  useEffect(() => {
    if (data) {
      init(projectId, data.rootFolderId, data.rootFiles, data.project)
    }
  }, [data, projectId, init])

  if (isLoading || !data) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="flex size-12 items-center justify-center rounded-lg bg-primary/20">
            <span className="text-lg font-bold text-primary">S</span>
          </div>
          <span className="text-sm">Loading editor...</span>
        </div>
      </div>
    )
  }

  return <AppLayout projectId={projectId} rootFolderId={data.rootFolderId} />
}
