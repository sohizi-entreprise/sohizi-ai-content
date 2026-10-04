import { useEffect, useRef, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import "@xzdarcy/react-timeline-editor/dist/react-timeline-editor.css"
import "../timeline/timeline.css"
import { useVideoEditorStore } from "../store/editor-store"
import { useVideoEditorUiStore } from "../store/ui-store"
import { loadCompositionQueryOptions } from "../query-mutations"
import { serverToHydration } from "../transforms"
import { PlayerRefProvider } from "../engine/player-ref"
import { useVideoEditorAutosave } from "../hooks/use-video-autosave"
import { useVideoEditorHotkeys } from "../hooks/use-video-editor-hotkeys"
import { useProjectFileTreeInit } from "../hooks/use-project-file-tree-init"

interface VideoEditorSessionProps {
  projectId: string
  fileNodeId: string
  children: ReactNode
}

export function VideoEditorSession({
  projectId,
  fileNodeId,
  children,
}: VideoEditorSessionProps) {
  const hydrate = useVideoEditorStore((s) => s.hydrate)
  const resetStore = useVideoEditorStore((s) => s.resetStore)
  const isHydrated = useVideoEditorStore((s) => s.isHydrated)
  const hydrationRef = useRef(false)

  useProjectFileTreeInit(projectId)

  const { data, isLoading, isError, error } = useQuery(
    loadCompositionQueryOptions(projectId, fileNodeId),
  )

  useEffect(() => {
    if (data && !hydrationRef.current) {
      hydrationRef.current = true
      const hydrationData = serverToHydration(data)
      hydrate({ ...hydrationData, projectId })
    }
  }, [data, hydrate, projectId])

  useEffect(() => {
    return () => {
      hydrationRef.current = false
      resetStore()
      useVideoEditorUiStore.getState().setPlaybackRate(1)
    }
  }, [fileNodeId, resetStore])

  if (isError) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-sm text-destructive">Failed to load composition</p>
          <p className="text-xs text-muted-foreground">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </div>
      </div>
    )
  }

  if (isLoading || !isHydrated) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-6 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">
            Loading video editor...
          </span>
        </div>
      </div>
    )
  }

  return <VideoEditorReady>{children}</VideoEditorReady>
}

function VideoEditorReady({ children }: { children: ReactNode }) {
  useVideoEditorAutosave()
  useVideoEditorHotkeys()

  return <PlayerRefProvider>{children}</PlayerRefProvider>
}
