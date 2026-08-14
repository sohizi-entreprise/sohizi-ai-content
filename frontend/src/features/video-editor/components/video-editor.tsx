import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import '@xzdarcy/react-timeline-editor/dist/react-timeline-editor.css'
import '../timeline/timeline.css'
import { useVideoEditorStore } from '../store/editor-store'
import { loadCompositionQueryOptions } from '../query-mutations'
import { serverToHydration } from '../transforms'
import { PlayerRefProvider } from '../engine/player-ref'
import { VideoTimeline } from '../timeline/timeline'
import { useVideoEditorAutosave } from '../hooks/use-video-autosave'
import { useVideoEditorHotkeys } from '../hooks/use-video-editor-hotkeys'
import { useProjectFileTreeInit } from '../hooks/use-project-file-tree-init'
import {
  ChatPanel,
  EditorTopBar,
  LeftPanel,
  PanelHandle,
  TimelineToolbar,
} from './layout'
import { Stage } from './stage/stage'
import { ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { useEditorStore } from '@/features/editor/stores/editor-store'

interface VideoEditorProps {
  projectId: string
  fileNodeId: string
}

export function VideoEditor({ projectId, fileNodeId }: VideoEditorProps) {
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
    }
  }, [fileNodeId, resetStore])

  if (isError) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-sm text-destructive">Failed to load composition</p>
          <p className="text-xs text-muted-foreground">
            {error instanceof Error ? error.message : 'Unknown error'}
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

  return <VideoEditorWorkspace projectId={projectId} fileNodeId={fileNodeId} />
}

function VideoEditorWorkspace({ projectId, fileNodeId }: VideoEditorProps) {
  useVideoEditorAutosave()
  useVideoEditorHotkeys()

  const isChatOpen = useEditorStore((s) => s.chatOpenByContext['video-editor'])

  return (
    <PlayerRefProvider>
      <div className="flex h-full w-full min-w-0 flex-col overflow-hidden bg-background">
        <EditorTopBar projectId={projectId} fileNodeId={fileNodeId} />

        <ResizablePanelGroup
          direction="horizontal"
          autoSaveId="video-editor:outer-horizontal"
          className="min-h-0 flex-1 p-2"
        >
          <ResizablePanel
            id="main"
            order={1}
            defaultSize={isChatOpen ? 76 : 100}
            minSize={50}
            className="min-w-0"
          >
            <ResizablePanelGroup
              direction="vertical"
              autoSaveId="video-editor:vertical"
              className="h-full min-h-0"
            >
              <ResizablePanel
                id="stage-row"
                order={1}
                defaultSize={62}
                minSize={30}
                className="min-h-0"
              >
                <ResizablePanelGroup
                  direction="horizontal"
                  autoSaveId="video-editor:horizontal"
                  className="h-full min-h-0"
                >
                  <ResizablePanel
                    id="library"
                    order={1}
                    defaultSize={26}
                    minSize={14}
                    maxSize={40}
                    className="min-w-0"
                  >
                    <LeftPanel projectId={projectId} />
                  </ResizablePanel>
                  <PanelHandle />

                  <ResizablePanel
                    id="stage"
                    order={2}
                    defaultSize={74}
                    minSize={40}
                    className="min-w-0"
                  >
                    <Stage />
                  </ResizablePanel>
                </ResizablePanelGroup>
              </ResizablePanel>

              <PanelHandle />

              <ResizablePanel
                id="timeline-row"
                order={2}
                defaultSize={38}
                minSize={22}
                className="flex min-h-0 flex-col"
              >
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-card ring-1 ring-border/60">
                  <TimelineToolbar />
                  <div className="min-h-0 flex-1 overflow-hidden">
                    <VideoTimeline />
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>

          {isChatOpen ? (
            <>
              <PanelHandle />
              <ResizablePanel
                id="chat"
                order={2}
                defaultSize={24}
                minSize={16}
                maxSize={40}
                className="min-w-0"
              >
                <ChatPanel projectId={projectId} />
              </ResizablePanel>
            </>
          ) : null}
        </ResizablePanelGroup>
      </div>
    </PlayerRefProvider>
  )
}
