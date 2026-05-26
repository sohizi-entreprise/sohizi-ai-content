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
import { MediaDropzone } from './media-dropzone'
import { SettingsSheet } from './settings/settings-sheet'
import { useVideoEditorAutosave } from '../hooks/use-video-autosave'
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

  return <VideoEditorCanvas projectId={projectId} />
}

function VideoEditorCanvas({ projectId }: { projectId: string }) {
  const width = useVideoEditorStore((s) => s.width)
  const height = useVideoEditorStore((s) => s.height)
  const aspectRatio = useMemo(() => width / height, [width, height])

  useVideoEditorAutosave()

  return (
    <PlayerRefProvider>
      <div className="flex h-full w-full flex-col overflow-hidden bg-background">
        <ResizablePanelGroup direction="vertical" className="h-full w-full">
          <ResizablePanel defaultSize={62} minSize={30}>
            <CanvasWrapper aspectRatio={aspectRatio}>
              <VideoEditorPlayer />
              <CanvasOverlay />
            </CanvasWrapper>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel
            defaultSize={38}
            minSize={20}
            maxSize={70}
            className="flex flex-col"
          >
            <Toolbar />
            <MediaDropzone projectId={projectId} />
            <div className="flex-1 overflow-hidden">
              <VideoTimeline />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      <SettingsSheet />
    </PlayerRefProvider>
  )
}
