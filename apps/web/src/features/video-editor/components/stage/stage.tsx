import { useMemo } from "react"
import { useVideoEditorStore } from "../../store/editor-store"
import { VideoEditorPlayer } from "../../engine/player"
import { CanvasWrapper } from "../canvas-wrapper"
import { CanvasOverlay } from "../canvas-overlay"
import { TransportBar } from "./transport-bar"

export function Stage() {
  const width = useVideoEditorStore((s) => s.width)
  const height = useVideoEditorStore((s) => s.height)
  const aspectRatio = useMemo(() => width / height, [width, height])

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl bg-card ring-1 ring-border/60">
      <div className="min-h-0 flex-1 p-3">
        <CanvasWrapper aspectRatio={aspectRatio}>
          <VideoEditorPlayer />
          <CanvasOverlay />
        </CanvasWrapper>
      </div>
      <TransportBar />
    </div>
  )
}
