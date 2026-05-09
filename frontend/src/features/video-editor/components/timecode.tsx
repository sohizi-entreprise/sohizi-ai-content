import { useVideoEditorStore } from '../store/editor-store'
import { formatPlayerTimecode } from '../utils/time'

export function Timecode() {
  const fps = useVideoEditorStore((s) => s.fps)
  const currentFrame = useVideoEditorStore((s) => s.currentFrame)
  const durationInFrames = useVideoEditorStore((s) => s.durationInFrames)

  return (
    <div className="font-mono text-xs tabular-nums text-foreground/90">
      {formatPlayerTimecode(currentFrame, fps)}
      <span className="mx-1 text-muted-foreground">/</span>
      <span className="text-muted-foreground">
        {formatPlayerTimecode(durationInFrames, fps)}
      </span>
    </div>
  )
}
