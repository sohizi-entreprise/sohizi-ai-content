import { Maximize2 } from "lucide-react"
import {
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconPlayerTrackNextFilled,
  IconPlayerTrackPrevFilled,
} from "@tabler/icons-react"
import { useVideoEditorStore } from "../../store/editor-store"
import { usePlayerRef } from "../../engine/player-ref"
import { formatPlayerTimecode } from "../../utils/time"
import { AspectRatioPicker } from "./aspect-ratio-picker"
import { Button } from "@sohizi/ui/button"

export function TransportBar() {
  const playerRef = usePlayerRef()

  const fps = useVideoEditorStore((s) => s.fps)
  const isPlaying = useVideoEditorStore((s) => s.isPlaying)
  const currentFrame = useVideoEditorStore((s) => s.currentFrame)
  const durationInFrames = useVideoEditorStore((s) => s.durationInFrames)
  const seekToFrame = useVideoEditorStore((s) => s.seekToFrame)

  const seek = (frame: number) => {
    seekToFrame(frame)
    playerRef.current?.seekTo(frame)
  }

  const togglePlay = () => {
    const player = playerRef.current
    if (!player) return
    if (player.isPlaying()) {
      player.pause()
    } else {
      player.play()
    }
  }

  return (
    <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-t border-border/60 px-3 bg-surface">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <AspectRatioPicker />
      </div>

      <div className="flex items-center gap-2">
        <span className="font-mono text-xs tabular-nums text-foreground">
          {formatPlayerTimecode(currentFrame, fps)}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7"
          onClick={() => seek(0)}
          title="Skip to start"
        >
          <IconPlayerTrackPrevFilled className="size-3.5" />
        </Button>
        <Button
          variant="default"
          size="icon-sm"
          className="size-9 rounded-full dark:bg-foreground/10 text-foreground"
          onClick={togglePlay}
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <IconPlayerPauseFilled className="size-4" />
          ) : (
            <IconPlayerPlayFilled className="size-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7"
          onClick={() => seek(Math.max(0, durationInFrames - 1))}
          title="Skip to end"
        >
          <IconPlayerTrackNextFilled className="size-3.5" />
        </Button>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {formatPlayerTimecode(durationInFrames, fps)}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end">
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-8 text-muted-foreground hover:text-foreground"
          onClick={() => {
            try {
              playerRef.current?.requestFullscreen()
            } catch {
              // Fullscreen can be blocked by the browser; nothing to recover.
            }
          }}
          title="Fullscreen"
        >
          <Maximize2 className="size-4" />
        </Button>
      </div>
    </div>
  )
}
