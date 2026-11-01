import type { ReactNode } from "react"
import { useVideoEditorStore } from "../../store/editor-store"
import { SliderWithValue } from "./slider-with-value"
import { cn } from "@/lib/utils"

interface SettingRowProps {
  label: string
  children: ReactNode
  className?: string
  align?: "center" | "start"
}

export function SettingRow({
  label,
  children,
  className,
  align = "center",
}: SettingRowProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-[96px_1fr] gap-3",
        align === "center" ? "items-center" : "items-start",
        className,
      )}
    >
      <div className="text-sm text-foreground">{label}</div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

interface SettingSectionProps {
  title?: string
  children: ReactNode
  className?: string
}

export function SettingSection({
  title,
  children,
  className,
}: SettingSectionProps) {
  return (
    <section className={cn("flex flex-col gap-2", className)}>
      {title ? (
        <h3 className="px-0.5 text-sm font-medium text-muted-foreground">
          {title}
        </h3>
      ) : null}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-background p-4">
        {children}
      </div>
    </section>
  )
}

interface FadeDurationFieldsProps {
  clipId: string
  startFrame: number
  endFrame: number
  fadeInFrames?: number
  fadeOutFrames?: number
}

export function FadeDurationFields({
  clipId,
  startFrame,
  endFrame,
  fadeInFrames = 0,
  fadeOutFrames = 0,
}: FadeDurationFieldsProps) {
  const fps = useVideoEditorStore((s) => s.fps)
  const updateClip = useVideoEditorStore((s) => s.updateClip)

  const safeFps = Math.max(1, fps)
  const clipDurationFrames = Math.max(1, endFrame - startFrame)
  const clipDurationSec = clipDurationFrames / safeFps

  // Cap each fade at half the clip's duration (up to 5.0s) so fade-in and fade-out never cross each other.
  const maxFadeSec = Number(
    Math.min(5, Math.max(0.1, clipDurationSec / 2)).toFixed(1),
  )

  const fadeInSec = Number(
    Math.min(maxFadeSec, Math.max(0, fadeInFrames / safeFps)).toFixed(1),
  )
  const fadeOutSec = Number(
    Math.min(maxFadeSec, Math.max(0, fadeOutFrames / safeFps)).toFixed(1),
  )

  const inPercent = Math.min(
    50,
    (fadeInSec / Math.max(0.1, clipDurationSec)) * 100,
  )
  const outPercent = Math.min(
    50,
    (fadeOutSec / Math.max(0.1, clipDurationSec)) * 100,
  )

  return (
    <div className="flex flex-col gap-3">
      {/* Visual envelope bar so the user sees where fade-in (start) and fade-out (end) apply on the clip */}
      <div className="flex flex-col gap-1.5 rounded-lg border border-border/70 bg-muted/30 p-2">
        <div className="relative h-5 w-full overflow-hidden rounded bg-primary/20">
          <svg
            aria-hidden
            viewBox="0 0 100 24"
            preserveAspectRatio="none"
            className="h-full w-full"
          >
            <polygon
              points={`0,24 ${inPercent},2 ${100 - outPercent},2 100,24`}
              fill="currentColor"
              className="text-primary/35"
            />
            <polyline
              points={`0,24 ${inPercent},2 ${100 - outPercent},2 100,24`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
              className="text-primary"
            />
          </svg>
        </div>
        <div className="flex items-center justify-between text-[11px] tabular-nums text-muted-foreground">
          <span>
            {fadeInSec > 0 ? `Start: ${fadeInSec}s` : "Start: instant"}
          </span>
          <span>{clipDurationSec.toFixed(1)}s clip</span>
          <span>{fadeOutSec > 0 ? `End: ${fadeOutSec}s` : "End: instant"}</span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Fade in (start)</span>
        <SliderWithValue
          min={0}
          max={maxFadeSec}
          step={0.1}
          value={fadeInSec}
          suffix="s"
          onChange={(sec) =>
            updateClip(clipId, {
              fadeInFrames: Math.min(
                Math.floor(clipDurationFrames / 2),
                Math.max(0, Math.round(sec * safeFps)),
              ),
            })
          }
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Fade out (end)</span>
        <SliderWithValue
          min={0}
          max={maxFadeSec}
          step={0.1}
          value={fadeOutSec}
          suffix="s"
          onChange={(sec) =>
            updateClip(clipId, {
              fadeOutFrames: Math.min(
                Math.floor(clipDurationFrames / 2),
                Math.max(0, Math.round(sec * safeFps)),
              ),
            })
          }
        />
      </div>
    </div>
  )
}
