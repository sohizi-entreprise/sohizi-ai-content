import { Redo2, Scissors, Trash2, Undo2 } from "lucide-react"
import { useTemporalStore, useVideoEditorStore } from "../../store/editor-store"
import { ZoomSlider } from "../zoom-slider"
import { Button } from "@sohizi/ui/button"

export function TimelineToolbar() {
  const splitClipAtPlayhead = useVideoEditorStore((s) => s.splitClipAtPlayhead)
  const deleteClip = useVideoEditorStore((s) => s.deleteClip)
  const selectedClipIds = useVideoEditorStore((s) => s.selection.clipIds)
  const undo = useTemporalStore((s) => s.undo)
  const redo = useTemporalStore((s) => s.redo)
  const pastStates = useTemporalStore((s) => s.pastStates)
  const futureStates = useTemporalStore((s) => s.futureStates)

  const handleSplit = () => {
    const state = useVideoEditorStore.getState()
    const candidate = findIntersectingClipId(state, state.currentFrame)
    if (candidate) splitClipAtPlayhead(candidate)
  }

  const handleDeleteSelected = () => {
    for (const id of [...selectedClipIds]) deleteClip(id)
  }

  return (
    <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border/60 px-3 bg-surface">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-8"
          onClick={() => undo()}
          disabled={pastStates.length === 0}
          title="Undo"
        >
          <Undo2 className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-8"
          onClick={() => redo()}
          disabled={futureStates.length === 0}
          title="Redo"
        >
          <Redo2 className="size-3.5" />
        </Button>

        <div className="mx-1 h-5 w-px bg-border" />

        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 rounded-lg px-2 text-xs font-medium text-foreground"
          onClick={handleSplit}
          title="Split at playhead"
          disabled={selectedClipIds.length === 0}
        >
          <Scissors className="size-3.5" />
          Split
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 rounded-lg px-2 text-xs font-medium text-foreground hover:text-destructive"
          onClick={handleDeleteSelected}
          disabled={selectedClipIds.length === 0}
          title="Delete selected clip"
        >
          <Trash2 className="size-3.5" />
          Delete
        </Button>
      </div>

      <ZoomSlider />
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
  for (const track of state.tracks) {
    for (const clip of track.clips) {
      if (frame > clip.startFrame && frame < clip.endFrame) return clip.id
    }
  }
  return null
}
