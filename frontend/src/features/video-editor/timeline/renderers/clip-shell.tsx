import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { TrackType } from '../../store/types'
import { cn } from '@/lib/utils'

/**
 * One accent hue per clip type. Blocks derive their surface, border and glyph
 * colors from it so the timeline stays readable in both themes without
 * competing with the brand green used for selection.
 */
export const CLIP_ACCENT: Record<TrackType, string> = {
  video: '#3b82f6',
  image: '#06b6d4',
  audio: '#f59e0b',
  text: '#8b5cf6',
  caption: '#ec4899',
  html: '#64748b',
}

export function clipSurface(type: TrackType, selected: boolean): string {
  const accent = CLIP_ACCENT[type]
  return `color-mix(in oklab, ${accent} ${selected ? 30 : 20}%, var(--card))`
}

interface ClipShellProps {
  type: TrackType
  selected: boolean
  label: string
  icon: LucideIcon
  children?: ReactNode
  /** Renders the label over the media instead of beside it. */
  labelOverlay?: boolean
}

export function ClipShell({
  type,
  selected,
  label,
  icon: Icon,
  children,
  labelOverlay = false,
}: ClipShellProps) {
  const accent = CLIP_ACCENT[type]

  return (
    <div
      className={cn(
        'relative h-full w-full rounded-md',
        selected && 'ring-2 ring-primary',
      )}
      style={{
        background: clipSurface(type, selected),
        boxShadow: selected
          ? undefined
          : `inset 0 0 0 1px color-mix(in oklab, ${accent} 55%, transparent)`,
      }}
    >
      {/* Inner clip keeps media rounded without clipping the selection ring. */}
      <div className="relative flex h-full w-full items-stretch overflow-hidden rounded-md">
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-[3px] rounded-l-md"
          style={{ background: accent }}
        />

        {labelOverlay ? (
          <>
            {children}
            <span className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-1 bg-gradient-to-b from-black/55 to-transparent py-1 pl-2.5 pr-2 text-[11px] font-medium text-white">
              <Icon className="size-3 shrink-0" />
              <span className="truncate">{label}</span>
            </span>
          </>
        ) : (
          <>
            <span className="flex h-full min-w-0 shrink items-center gap-1 pl-2.5 pr-1.5 text-[11px] font-medium text-foreground">
              <Icon className="size-3 shrink-0" style={{ color: accent }} />
              <span className="truncate">{label}</span>
            </span>
            {children}
          </>
        )}
      </div>
    </div>
  )
}
