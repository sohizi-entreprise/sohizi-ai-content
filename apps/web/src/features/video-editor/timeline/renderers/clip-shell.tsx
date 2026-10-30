import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import type { TrackType } from "../../store/types"
import { cn } from "@/lib/utils"

/**
 * One accent hue per clip type. Blocks derive their surface, border and glyph
 * colors from it so the timeline stays readable in both themes without
 * competing with the brand green used for selection.
 */
export const CLIP_ACCENT: Record<TrackType, string> = {
  video: "#3b82f6",
  image: "#06b6d4",
  audio: "#f59e0b",
  text: "#8b5cf6",
  caption: "#ec4899",
}

export function clipSurface(type: TrackType, selected: boolean): string {
  const accent = CLIP_ACCENT[type]
  return `color-mix(in oklab, ${accent} ${selected ? 30 : 20}%, var(--card))`
}

export function getClipFadeRatios(clip: {
  startFrame: number
  endFrame: number
  fadeInFrames?: number
  fadeOutFrames?: number
}): { fadeInRatio: number; fadeOutRatio: number } {
  const duration = Math.max(1, clip.endFrame - clip.startFrame)
  const fadeIn = Math.max(0, clip.fadeInFrames ?? 0)
  const fadeOut = Math.max(0, clip.fadeOutFrames ?? 0)
  return {
    fadeInRatio: Math.min(0.5, fadeIn / duration),
    fadeOutRatio: Math.min(0.5, fadeOut / duration),
  }
}

interface ClipShellProps {
  type: TrackType
  selected: boolean
  label: string
  icon: LucideIcon
  children?: ReactNode
  /** Renders the label over the media instead of beside it. */
  labelOverlay?: boolean
  /** Fraction (0..0.5) of clip width occupied by the start fade-in ramp. */
  fadeInRatio?: number
  /** Fraction (0..0.5) of clip width occupied by the end fade-out ramp. */
  fadeOutRatio?: number
}

export function ClipShell({
  type,
  selected,
  label,
  icon: Icon,
  children,
  labelOverlay = false,
  fadeInRatio = 0,
  fadeOutRatio = 0,
}: ClipShellProps) {
  const accent = CLIP_ACCENT[type]
  const showFadeIn = fadeInRatio > 0.005
  const showFadeOut = fadeOutRatio > 0.005

  return (
    <div
      className={cn(
        "relative h-full w-full rounded-md",
        selected && "ring-2 ring-primary",
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
          className="absolute inset-y-0 left-0 z-10 w-[3px] rounded-l-md"
          style={{ background: accent }}
        />

        {labelOverlay ? (
          <>
            {children}
            <span className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center gap-1 bg-linear-to-b from-black/55 to-transparent py-1 pl-2.5 pr-2 text-[11px] font-medium text-white">
              <Icon className="size-3 shrink-0" />
              <span className="truncate">{label}</span>
            </span>
          </>
        ) : (
          <>
            <span className="relative z-10 flex h-full min-w-0 shrink items-center gap-1 pl-2.5 pr-1.5 text-[11px] font-medium text-foreground">
              <Icon className="size-3 shrink-0" style={{ color: accent }} />
              <span className="truncate">{label}</span>
            </span>
            {children}
          </>
        )}

        {showFadeIn ? (
          <svg
            aria-hidden
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-y-0 left-0 z-20 h-full"
            style={{ width: `${Math.min(50, fadeInRatio * 100)}%` }}
          >
            <path
              d="M 0 0 L 100 0 Q 35 15 0 100 Z"
              fill="rgba(0, 0, 0, 0.48)"
            />
            <path
              d="M 0 100 Q 35 15 100 0"
              fill="none"
              stroke="rgba(255, 255, 255, 0.85)"
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        ) : null}

        {showFadeOut ? (
          <svg
            aria-hidden
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-y-0 right-0 z-20 h-full"
            style={{ width: `${Math.min(50, fadeOutRatio * 100)}%` }}
          >
            <path
              d="M 0 0 L 100 0 L 100 100 Q 65 15 0 0 Z"
              fill="rgba(0, 0, 0, 0.48)"
            />
            <path
              d="M 0 0 Q 65 15 100 100"
              fill="none"
              stroke="rgba(255, 255, 255, 0.85)"
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        ) : null}
      </div>
    </div>
  )
}
