import { useEffect, useRef, useState } from 'react'
import {
  AudioLines,
  Code2,
  Eye,
  EyeOff,
  Film,
  ImageIcon,
  MoreHorizontal,
  Subtitles,
  Trash2,
  Type,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useVideoEditorStore } from '../store/editor-store'
import type { LucideIcon } from 'lucide-react'
import type { Track, TrackType } from '../store/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface TrackHeadersProps {
  rowHeight: number
  scrollTop: number
  width: number
  /** Aligns the first row with the timeline's ruler + edit-area offset. */
  topOffset: number
}

const TRACK_ICON: Record<TrackType, LucideIcon> = {
  video: Film,
  audio: AudioLines,
  image: ImageIcon,
  text: Type,
  caption: Subtitles,
  html: Code2,
}

const iconBtn =
  'size-7 shrink-0 rounded-md text-muted-foreground/55 hover:bg-muted/55 hover:text-foreground/80'

export function TrackHeaders({
  rowHeight,
  scrollTop,
  width,
  topOffset,
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
      // Some browsers reject custom payloads; the index state is enough.
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
      className="shrink-0 overflow-hidden border-r border-border/40 bg-background/40"
      style={{ width }}
    >
      <div style={{ paddingTop: topOffset }}>
        {tracks.map((track, index) => (
          <TrackHeaderRow
            key={track.id}
            track={track}
            rowHeight={rowHeight}
            isDragOver={hoverIndex === index && draggingIndex !== index}
            isDragging={draggingIndex === index}
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
  isDragging: boolean
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
  isDragging,
  onToggleHidden,
  onToggleMuted,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: TrackHeaderRowProps) {
  const Icon = TRACK_ICON[track.type]
  const hasAudio = track.type === 'audio' || track.type === 'video'

  return (
    <div
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn(
        'group/track flex items-center justify-center gap-0.5 border-b border-border/30 px-3 transition-colors',
        isDragOver && 'bg-surface',
        isDragging && 'opacity-35',
      )}
      style={{ height: rowHeight }}
    >
      {/* Type identity doubles as drag handle — keeps the rail icon-only. */}
      <div
        draggable
        onDragStart={onDragStart}
        title={`${track.name} · drag to reorder`}
        className={cn(
          'flex size-7 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground/65 transition-colors active:cursor-grabbing',
          'hover:bg-muted/55 hover:text-foreground/80',
          track.hidden && 'opacity-45',
        )}
      >
        <Icon className="size-3.5" strokeWidth={1.75} />
      </div>

      <Button
        variant="ghost"
        size="icon-sm"
        className={cn(
          iconBtn,
          track.hidden && 'bg-muted/45 text-foreground/75',
        )}
        onClick={onToggleHidden}
        title={track.hidden ? 'Show track' : 'Hide track'}
      >
        {track.hidden ? (
          <EyeOff className="size-3.5" strokeWidth={1.75} />
        ) : (
          <Eye className="size-3.5" strokeWidth={1.75} />
        )}
      </Button>

      {hasAudio ? (
        <Button
          variant="ghost"
          size="icon-sm"
          className={cn(
            iconBtn,
            track.muted && 'bg-muted/45 text-foreground/75',
          )}
          onClick={onToggleMuted}
          title={track.muted ? 'Unmute track' : 'Mute track'}
        >
          {track.muted ? (
            <VolumeX className="size-3.5" strokeWidth={1.75} />
          ) : (
            <Volume2 className="size-3.5" strokeWidth={1.75} />
          )}
        </Button>
      ) : (
        <span className="size-7 shrink-0" aria-hidden />
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className={iconBtn}
            title="Track options"
          >
            <MoreHorizontal className="size-3.5" strokeWidth={1.75} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="right" className="min-w-36">
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2 className="size-3.5" />
            Delete track
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
