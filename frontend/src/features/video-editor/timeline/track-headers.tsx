import { useEffect, useRef, useState } from 'react'
import {
  Eye,
  EyeOff,
  GripVertical,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useVideoEditorStore } from '../store/editor-store'
import type { Track } from '../store/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface TrackHeadersProps {
  rowHeight: number
  scrollTop: number
  width: number
}

const ROW_VERTICAL_GAP = 1

export function TrackHeaders({
  rowHeight,
  scrollTop,
  width,
}: TrackHeadersProps) {
  const tracks = useVideoEditorStore((s) => s.tracks)
  const toggleTrackHidden = useVideoEditorStore((s) => s.toggleTrackHidden)
  const toggleTrackMuted = useVideoEditorStore((s) => s.toggleTrackMuted)
  const removeTrack = useVideoEditorStore((s) => s.removeTrack)
  const reorderTracks = useVideoEditorStore((s) => s.reorderTracks)

  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const node = containerRef.current
    if (!node) return
    node.scrollTop = scrollTop
  }, [scrollTop])

  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    setDraggingIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    try {
      e.dataTransfer.setData('text/plain', String(index))
    } catch {
      // ignore
    }
  }

  const handleDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault()
    setHoverIndex(index)
  }

  const handleDrop = (index: number) => (e: React.DragEvent) => {
    e.preventDefault()
    const fromStr = e.dataTransfer.getData('text/plain')
    const from = fromStr ? Number(fromStr) : draggingIndex
    if (from === null || Number.isNaN(from)) return
    if (from !== index) reorderTracks(from, index)
    setDraggingIndex(null)
    setHoverIndex(null)
  }

  const handleDragEnd = () => {
    setDraggingIndex(null)
    setHoverIndex(null)
  }

  return (
    <div
      ref={containerRef}
      className="overflow-hidden border-r border-border bg-card"
      style={{ width }}
    >
      <div>
        {tracks.map((track, index) => (
          <TrackHeaderRow
            key={track.id}
            track={track}
            rowHeight={rowHeight}
            isDragOver={hoverIndex === index && draggingIndex !== index}
            onToggleHidden={() => toggleTrackHidden(track.id)}
            onToggleMuted={() => toggleTrackMuted(track.id)}
            onDelete={() => removeTrack(track.id)}
            onDragStart={handleDragStart(index)}
            onDragOver={handleDragOver(index)}
            onDrop={handleDrop(index)}
            onDragEnd={handleDragEnd}
          />
        ))}
      </div>
    </div>
  )
}

interface TrackHeaderRowProps {
  track: Track
  rowHeight: number
  isDragOver: boolean
  onToggleHidden: () => void
  onToggleMuted: () => void
  onDelete: () => void
  onDragStart: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onDragEnd: (e: React.DragEvent) => void
}

function TrackHeaderRow({
  track,
  rowHeight,
  isDragOver,
  onToggleHidden,
  onToggleMuted,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: TrackHeaderRowProps) {
  return (
    <div
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn(
        'flex items-center gap-1 px-1.5 text-[11px]',
        isDragOver ? 'bg-accent/40' : 'bg-transparent',
      )}
      style={{ height: rowHeight, marginBottom: ROW_VERTICAL_GAP }}
    >
      <div
        draggable
        onDragStart={onDragStart}
        className="flex h-full cursor-grab items-center px-1 text-muted-foreground active:cursor-grabbing"
        title="Drag to reorder"
      >
        <GripVertical className="size-3" />
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        className="size-6"
        onClick={onToggleHidden}
        title={track.hidden ? 'Show track' : 'Hide track'}
      >
        {track.hidden ? (
          <EyeOff className="size-3.5 text-muted-foreground" />
        ) : (
          <Eye className="size-3.5" />
        )}
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="size-6"
        onClick={onToggleMuted}
        title={track.muted ? 'Unmute track' : 'Mute track'}
      >
        {track.muted ? (
          <VolumeX className="size-3.5 text-muted-foreground" />
        ) : (
          <Volume2 className="size-3.5" />
        )}
      </Button>
      <div className="flex-1 truncate text-foreground">{track.name}</div>
      <Button
        variant="ghost"
        size="icon-sm"
        className="size-6 text-muted-foreground hover:text-destructive"
        onClick={onDelete}
        title="Delete track"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  )
}
