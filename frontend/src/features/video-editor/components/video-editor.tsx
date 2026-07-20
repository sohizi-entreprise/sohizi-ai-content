import { useEffect, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import '@xzdarcy/react-timeline-editor/dist/react-timeline-editor.css'
import { useVideoEditorStore } from '../store/editor-store'
import { loadCompositionQueryOptions } from '../query-mutations'
import { serverToHydration } from '../transforms'
import { PlayerRefProvider } from '../engine/player-ref'
import { VideoEditorPlayer } from '../engine/player'
import { VideoTimeline } from '../timeline/timeline'
import { CanvasWrapper } from './canvas-wrapper'
import { CanvasOverlay } from './canvas-overlay'
import { Toolbar } from './toolbar'
import { SettingsPanel } from './settings/settings-panel'
import { ActionsButtons } from './actions-buttons'
import { useVideoEditorAutosave } from '../hooks/use-video-autosave'
import { useVideoEditorHotkeys } from '../hooks/use-video-editor-hotkeys'
import { Loader2 } from 'lucide-react'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'

interface VideoEditorProps {
  projectId: string
  fileNodeId: string
}

export function VideoEditor({ projectId, fileNodeId }: VideoEditorProps) {
  const hydrate = useVideoEditorStore((s) => s.hydrate)
  const resetStore = useVideoEditorStore((s) => s.resetStore)
  const isHydrated = useVideoEditorStore((s) => s.isHydrated)
  const hydrationRef = useRef(false)

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

  if (isLoading || !isHydrated) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Loading video editor...
          </span>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-sm text-destructive">
            Failed to load composition
          </p>
          <p className="text-xs text-muted-foreground">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </div>
      </div>
    )
  }

  return <VideoEditorCanvas />
}

function VideoEditorCanvas() {
  useVideoEditorAutosave()
  useVideoEditorHotkeys()

  return (
    <PlayerRefProvider>
      <div className="flex h-full w-full flex-col overflow-hidden">
        <ResizablePanelGroup direction="vertical" className="h-full w-full">
          <ResizablePanel defaultSize={65} minSize={40} className="min-h-0">
            <RenderTopCanvas />
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel
            defaultSize={35}
            minSize={30}
            maxSize={60}
            className="flex flex-col"
          >
            <Toolbar />
            <div className="flex-1 overflow-hidden">
              <VideoTimeline />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </PlayerRefProvider>
  )
}

function RenderTopCanvas(){
  const width = useVideoEditorStore((s) => s.width)
  const height = useVideoEditorStore((s) => s.height)
  const aspectRatio = useMemo(() => width / height, [width, height])

  return (
    <div className="grid size-full min-h-0 grid-cols-[auto_1fr] grid-rows-[1fr_auto] gap-2 p-2">
      <div className="row-span-2 min-h-0 w-90 overflow-hidden rounded-lg bg-muted/40">
        <SettingsPanel />
      </div>

      <CanvasWrapper
        aspectRatio={aspectRatio}
        className="min-h-0 rounded-lg bg-background"
      >
        <VideoEditorPlayer />
        <CanvasOverlay />
      </CanvasWrapper>

      <ActionsButtons />
    </div>
  )
}
