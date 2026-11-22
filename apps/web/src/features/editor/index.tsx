import { useEffect, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { useParams } from "@tanstack/react-router"
import { getProjectQueryOptions } from "../projects/query-mutation"
import { useEditorStore } from "./stores/editor-store"
import { useFileTreeStore } from "./stores/file-tree-store"
import { AppLayout } from "./components/layout/app-layout"
import { RoutePending } from "@/components/layout/route-pending"

export function VideoProductionEditor() {
  const { projectId } = useParams({
    from: "/_authenticated/projects/$projectId/editor",
  })

  const { data, isPending, isError } = useQuery(
    getProjectQueryOptions(projectId),
  )
  const init = useFileTreeStore((s) => s.init)
  const initializedProjectRef = useRef<string | null>(null)

  useEffect(() => {
    if (data) {
      init(projectId, data.rootFolderId, data.project)
      if (initializedProjectRef.current !== projectId) {
        initializedProjectRef.current = projectId
        if (useEditorStore.getState().openTabs.length === 0) {
          void useEditorStore.getState().openFileByPath("/root/core/brief")
        }
      }
    }
  }, [data, projectId, init])

  if (isPending) {
    return <RoutePending />
  }

  if (isError) {
    return (
      <div className="flex h-full min-h-0 w-full flex-1 items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Failed to load project.</p>
      </div>
    )
  }

  return <AppLayout projectId={projectId} rootFolderId={data.rootFolderId} />
}
