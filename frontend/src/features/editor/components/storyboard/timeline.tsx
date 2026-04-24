import { Video, Type, AudioLines, Lock, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MOCK_TIMELINE_TRACKS } from '../../mock-data'

const TRACK_ICONS = {
  video: Video,
  text: Type,
  audio: AudioLines,
}

function TimelineRuler() {
  const marks = Array.from({ length: 11 }, (_, i) => i * 10)
  return (
    <div className="flex h-6 items-end border-b border-border pl-[120px]">
      {marks.map((mark) => (
        <div
          key={mark}
          className="flex shrink-0 items-end"
          style={{ width: `${100 / marks.length}%` }}
        >
          <span className="text-[9px] tabular-nums text-muted-foreground/60">
            {String(Math.floor(mark / 60)).padStart(2, '0')}:
            {String(mark % 60).padStart(2, '0')}
          </span>
          <div className="ml-0.5 h-2 w-px bg-border" />
        </div>
      ))}
    </div>
  )
}

function Playhead() {
  return (
    <div
      className="absolute top-0 bottom-0 z-10 w-px bg-primary"
      style={{ left: 'calc(120px + 35%)' }}
    >
      <div className="absolute -left-1.5 -top-0 size-3 rounded-b-sm bg-primary" />
    </div>
  )
}

export function Timeline() {
  return (
    <div className="flex h-full flex-col border-t border-border bg-background">
      <TimelineRuler />
      <ScrollArea className="relative flex-1">
        <Playhead />
        <div className="flex flex-col">
          {MOCK_TIMELINE_TRACKS.map((track) => {
            const Icon = TRACK_ICONS[track.type]
            return (
              <div key={track.id} className="flex h-10 border-b border-border/50">
                {/* Track label */}
                <div className="flex w-[120px] shrink-0 items-center gap-2 border-r border-border px-3">
                  <Icon className="size-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {track.label}
                  </span>
                  <div className="ml-auto flex items-center gap-0.5">
                    <button className="text-muted-foreground/40 hover:text-muted-foreground">
                      <Eye className="size-3" />
                    </button>
                    <button className="text-muted-foreground/40 hover:text-muted-foreground">
                      <Lock className="size-3" />
                    </button>
                  </div>
                </div>

                {/* Track clips */}
                <div className="relative flex-1 px-0.5 py-1">
                  {track.clips.map((clip) => (
                    <div
                      key={clip.id}
                      className={cn(
                        'absolute top-1 bottom-1 flex items-center rounded px-2 text-[10px] font-medium text-foreground/80 cursor-pointer transition-opacity hover:opacity-80',
                        clip.color,
                      )}
                      style={{
                        left: `${clip.start}%`,
                        width: `${clip.end - clip.start}%`,
                      }}
                    >
                      <span className="truncate">{clip.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
