import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, ImageIcon, Pause, Play } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@sohizi/ui/dialog"
import { aspectRatioToCss } from "../../extensions/storyboard"
import { SEQUENCE_SHOT_SECONDS } from "../../extensions/storyboard/storyboard-sequence"
import type { CSSProperties } from "react"
import type { StoryboardAspectRatio } from "../../extensions/storyboard"
import type { SequenceShot } from "../../extensions/storyboard/storyboard-sequence"
import { cn } from "@/lib/utils"
import { thumbnailImageUrl } from "@/utils/transform-url"

type StoryboardSequenceDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  shots: Array<SequenceShot>
  aspectRatio: StoryboardAspectRatio
}

function formatTimecode(totalSeconds: number): string {
  const whole = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(whole / 60)
  const seconds = whole % 60
  const tenths = Math.floor((Math.max(0, totalSeconds) - whole) * 10)
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`
}

export function StoryboardSequenceDialog({
  open,
  onOpenChange,
  shots,
  aspectRatio,
}: StoryboardSequenceDialogProps) {
  const aspectCss = aspectRatioToCss(aspectRatio)
  const [activeIndex, setActiveIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [shotProgress, setShotProgress] = useState(0)
  const timelineRef = useRef<HTMLDivElement | null>(null)
  const thumbRefs = useRef<Array<HTMLButtonElement | null>>([])

  const lastIndex = Math.max(shots.length - 1, 0)
  const safeIndex = Math.min(Math.max(activeIndex, 0), lastIndex)
  const current = shots.length > 0 ? shots[safeIndex] : undefined

  // Cumulative start time for each shot on the timeline
  const shotStartTimes = useMemo(() => {
    const starts: Array<number> = []
    let acc = 0
    for (const shot of shots) {
      starts.push(acc)
      acc += shot.durationSeconds || SEQUENCE_SHOT_SECONDS
    }
    return starts
  }, [shots])

  const stepToShot = useCallback(
    (nextIndex: number) => {
      setPlaying(false)
      setShotProgress(0)
      setActiveIndex(Math.min(Math.max(nextIndex, 0), lastIndex))
    },
    [lastIndex],
  )

  const togglePlayback = useCallback(() => {
    if (shots.length === 0) return
    setPlaying((wasPlaying) => {
      if (!wasPlaying && safeIndex >= lastIndex && shotProgress >= 0.99) {
        setActiveIndex(0)
        setShotProgress(0)
      } else if (!wasPlaying && safeIndex >= lastIndex) {
        // If at the last slide and user clicks play, restart from beginning
        setActiveIndex(0)
        setShotProgress(0)
      }
      return !wasPlaying
    })
  }, [shots.length, safeIndex, lastIndex, shotProgress])

  // Reset state when dialog closes
  useEffect(() => {
    if (open) return
    setActiveIndex(0)
    setPlaying(false)
    setShotProgress(0)
  }, [open])

  // Autoplay timer with smooth progress updates
  useEffect(() => {
    if (!open || !playing || shots.length === 0) return

    const durationMs =
      (shots[safeIndex]?.durationSeconds ?? SEQUENCE_SHOT_SECONDS) * 1000
    const startedAt = performance.now()
    let rafId = 0

    const tick = (now: number) => {
      const elapsed = now - startedAt
      const ratio = Math.min(1, elapsed / durationMs)
      setShotProgress(ratio)

      if (elapsed >= durationMs) {
        if (safeIndex < lastIndex) {
          setShotProgress(0)
          setActiveIndex((prev) => Math.min(prev + 1, lastIndex))
        } else {
          setPlaying(false)
          setShotProgress(1)
        }
        return
      }
      rafId = window.requestAnimationFrame(tick)
    }

    rafId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(rafId)
  }, [open, playing, safeIndex, lastIndex, shots])

  // Scroll active thumbnail into view smoothly
  useEffect(() => {
    if (!open) return
    const thumb = thumbRefs.current[safeIndex]
    if (!thumb) return
    thumb.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    })
  }, [open, safeIndex])

  // Keyboard navigation
  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === " " || event.code === "Space") {
        event.preventDefault()
        togglePlayback()
        return
      }
      if (event.key === "ArrowRight") {
        event.preventDefault()
        stepToShot(safeIndex + 1)
        return
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault()
        stepToShot(safeIndex - 1)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, safeIndex, stepToShot, togglePlayback])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="storyboard-sequence-dialog flex h-[90vh] max-h-[90vh] w-full max-w-[calc(100%-2rem)] flex-col p-0 sm:max-w-5xl md:max-w-6xl"
        style={{ "--storyboard-aspect": aspectCss } as CSSProperties}
      >
        <DialogTitle className="sr-only">Storyboard sequence</DialogTitle>
        <DialogDescription className="sr-only">
          Preview and autoplay storyboard shots along a timeline.
        </DialogDescription>

        {/* Main Viewport Stage */}
        <div className="storyboard-sequence-stage">
          {current ? (
            <div
              className="storyboard-sequence-frame"
              onClick={togglePlayback}
              role="button"
              tabIndex={-1}
              aria-label={playing ? "Pause autoplay" : "Start autoplay"}
            >
              {current.image ? (
                <img
                  key={`${current.sceneNumber}-${current.shotNumber}-${current.image}`}
                  src={thumbnailImageUrl(current.image, "large")}
                  alt={`Scene ${current.sceneNumber}, Shot ${current.shotNumber}`}
                />
              ) : (
                <div className="storyboard-sequence-frame-empty">
                  <ImageIcon className="size-9 opacity-40" />
                </div>
              )}

              {current.subtitle ? (
                <div
                  className="storyboard-sequence-caption-wrap"
                  onClick={(event) => event.stopPropagation()}
                >
                  <p className="storyboard-sequence-caption">
                    {current.subtitle}
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="storyboard-sequence-frame-empty">
              <ImageIcon className="size-8 opacity-40" />
              <span>No shots to preview</span>
            </div>
          )}
        </div>

        {/* Transport Control Bar */}
        <div className="storyboard-sequence-controls">
          <div className="storyboard-sequence-controls-left">
            <button
              type="button"
              className={cn(
                "storyboard-sequence-play",
                playing && "is-playing",
              )}
              onClick={togglePlayback}
              disabled={shots.length === 0}
              aria-label={playing ? "Pause sequence" : "Play sequence"}
              title={playing ? "Pause (Space)" : "Autoplay (Space)"}
            >
              {playing ? (
                <Pause className="size-4 fill-current" />
              ) : (
                <Play className="size-4 translate-x-[0.5px] fill-current" />
              )}
            </button>

            <div className="storyboard-sequence-status">
              <span className="storyboard-sequence-index">
                <strong>{shots.length > 0 ? safeIndex + 1 : 0}</strong>
                <span>/ {shots.length}</span>
              </span>
              {current ? (
                <span className="storyboard-sequence-scene-tag">
                  Scene {String(current.sceneNumber).padStart(2, "0")} · Shot{" "}
                  {String(current.shotNumber).padStart(2, "0")}
                </span>
              ) : null}
            </div>
          </div>

          <div className="storyboard-sequence-controls-right">
            <button
              type="button"
              className="storyboard-sequence-nav"
              onClick={() => stepToShot(safeIndex - 1)}
              disabled={safeIndex <= 0}
              aria-label="Previous shot"
              title="Previous shot (←)"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              className="storyboard-sequence-nav"
              onClick={() => stepToShot(safeIndex + 1)}
              disabled={safeIndex >= lastIndex}
              aria-label="Next shot"
              title="Next shot (→)"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        {/* Single-Line Filmstrip Timeline */}
        <div
          ref={timelineRef}
          className="storyboard-sequence-timeline scrollbar-hide"
        >
          <div className="storyboard-sequence-track">
            {shots.map((shot, index) => {
              const isActive = index === safeIndex
              const isPast = index < safeIndex
              const startSec = shotStartTimes[index] ?? 0
              const fillPercent = isPast
                ? 100
                : isActive
                  ? playing
                    ? Math.round(shotProgress * 100)
                    : 100
                  : 0

              return (
                <button
                  key={`${shot.sceneNumber}-${shot.shotNumber}-${index}`}
                  ref={(el) => {
                    thumbRefs.current[index] = el
                  }}
                  type="button"
                  onClick={() => stepToShot(index)}
                  aria-label={`Scene ${shot.sceneNumber}, Shot ${shot.shotNumber}`}
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "storyboard-sequence-cell",
                    isActive && "is-active",
                    isPast && "is-past",
                  )}
                >
                  {/* Ruler & Timecode Node */}
                  <div className="storyboard-sequence-ruler">
                    <span className="storyboard-sequence-timecode">
                      {formatTimecode(startSec)}
                    </span>
                    <div className="storyboard-sequence-rail-line">
                      <div
                        className="storyboard-sequence-rail-fill"
                        style={{ width: `${fillPercent}%` }}
                      />
                      <span
                        className={cn(
                          "storyboard-sequence-rail-dot",
                          isActive && "is-active",
                          isPast && "is-past",
                        )}
                      >
                        {isActive ? index + 1 : null}
                      </span>
                    </div>
                  </div>

                  {/* Thumbnail Frame */}
                  <div className="storyboard-sequence-thumb">
                    {shot.image ? (
                      <img
                        src={thumbnailImageUrl(shot.image)}
                        alt={`Shot ${index + 1}`}
                      />
                    ) : (
                      <div className="storyboard-sequence-thumb-empty">
                        <ImageIcon className="size-4 opacity-40" />
                      </div>
                    )}
                    <span className="storyboard-sequence-thumb-badge">
                      {index + 1}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
