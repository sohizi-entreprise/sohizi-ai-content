import {
  ChevronsLeft,
  ChevronsRight,
  Pause,
  Play,
  Redo2,
  Scissors,
  Trash2,
  Undo2,
} from 'lucide-react'
import { useVideoEditorStore, useTemporalStore } from '../store/editor-store'
import { usePlayerRef } from '../engine/player-ref'
import { Timecode } from './timecode'
import { AspectRatioSelect } from './aspect-ratio-select'
import { ZoomSlider } from './zoom-slider'
import { Button } from '@/components/ui/button'

export function Toolbar() {
  const playerRef = usePlayerRef()

  const isPlaying = useVideoEditorStore((s) => s.isPlaying)
  const durationInFrames = useVideoEditorStore((s) => s.durationInFrames)
  const seekToFrame = useVideoEditorStore((s) => s.seekToFrame)
  const splitClipAtPlayhead = useVideoEditorStore((s) => s.splitClipAtPlayhead)
  const deleteClip = useVideoEditorStore((s) => s.deleteClip)
  const selectedClipIds = useVideoEditorStore((s) => s.selection.clipIds)

  const undo = useTemporalStore((s) => s.undo)
  const redo = useTemporalStore((s) => s.redo)
  const pastStates = useTemporalStore((s) => s.pastStates)
  const futureStates = useTemporalStore((s) => s.futureStates)

  const handleSplit = () => {
    const state = useVideoEditorStore.getState()
    const frame = state.currentFrame
    const candidate = findIntersectingClipId(state, frame)
    if (candidate) splitClipAtPlayhead(candidate)
  }

  const handleDeleteSelected = () => {
    if (selectedClipIds.length === 0) return
    for (const id of [...selectedClipIds]) deleteClip(id)
  }

  const handleSkipStart = () => {
    seekToFrame(0)
    playerRef.current?.seekTo(0)
  }

  const handleSkipEnd = () => {
    const last = Math.max(0, durationInFrames - 1)
    seekToFrame(last)
    playerRef.current?.seekTo(last)
  }

  const handleTogglePlay = () => {
    const player = playerRef.current
    if (!player) return
    if (player.isPlaying()) {
      player.pause()
    } else {
      player.play()
    }
  }

  return (
    <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-y border-border bg-card px-3">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7"
          onClick={() => undo()}
          disabled={pastStates.length === 0}
          title="Undo"
        >
          <Undo2 className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7"
          onClick={() => redo()}
          disabled={futureStates.length === 0}
          title="Redo"
        >
          <Redo2 className="size-4" />
        </Button>
        <div className="mx-1 h-5 w-px bg-border" />
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7"
          onClick={handleSplit}
          title="Split at playhead"
        >
          <Scissors className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7"
          onClick={handleDeleteSelected}
          disabled={selectedClipIds.length === 0}
          title="Delete clip"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7"
          onClick={handleSkipStart}
          title="Skip to start"
        >
          <ChevronsLeft className="size-4" />
        </Button>
        <Button
          variant="default"
          size="icon-sm"
          className="size-8 rounded-full"
          onClick={handleTogglePlay}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="size-4" />
          ) : (
            <Play className="size-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7"
          onClick={handleSkipEnd}
          title="Skip to end"
        >
          <ChevronsRight className="size-4" />
        </Button>
        <div className="mx-2">
          <Timecode />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <AspectRatioSelect />
        <ZoomSlider />
      </div>
    </div>
  )
}

function findIntersectingClipId(
  state: ReturnType<typeof useVideoEditorStore.getState>,
  frame: number,
): string | null {
  const selected = state.selection.clipIds
  for (const track of state.tracks) {
    for (const clip of track.clips) {
      if (frame > clip.startFrame && frame < clip.endFrame) {
        if (selected.includes(clip.id)) return clip.id
      }
    }
  }
  // Fallback: any clip intersecting playhead.
  for (const track of state.tracks) {
    for (const clip of track.clips) {
      if (frame > clip.startFrame && frame < clip.endFrame) {
        return clip.id
      }
    }
  }
  return null
}
