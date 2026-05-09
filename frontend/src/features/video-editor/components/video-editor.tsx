import { useMemo } from 'react'
import '@xzdarcy/react-timeline-editor/dist/react-timeline-editor.css'
import { useVideoEditorStore } from '../store/editor-store'
import { PlayerRefProvider } from '../engine/player-ref'
import { VideoEditorPlayer } from '../engine/player'
import { VideoTimeline } from '../timeline/timeline'
import { CanvasWrapper } from './canvas-wrapper'
import { CanvasOverlay } from './canvas-overlay'
import { Toolbar } from './toolbar'
import { MediaDropzone } from './media-dropzone'
import { SettingsSheet } from './settings/settings-sheet'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'

export function VideoEditor() {
  const width = useVideoEditorStore((s) => s.width)
  const height = useVideoEditorStore((s) => s.height)
  const aspectRatio = useMemo(() => width / height, [width, height])

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
            <MediaDropzone />
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
