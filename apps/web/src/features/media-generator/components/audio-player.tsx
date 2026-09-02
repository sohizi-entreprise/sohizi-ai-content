import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { Pause, Play, Volume2, VolumeX } from "lucide-react"

import { Slider } from "@sohizi/ui/slider"
import { cn } from "@/lib/utils"

type TimeDisplay = "elapsed" | "remaining"

type AudioPlayerProps = {
  src: string
  title?: string
  className?: string
  timeDisplay?: TimeDisplay
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00"
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

export default function AudioPlayer({
  src,
  title,
  className,
  timeDisplay = "elapsed",
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [showVolume, setShowVolume] = useState(false)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onLoadedMetadata = () => setDuration(audio.duration)
    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
    }
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)

    audio.addEventListener("loadedmetadata", onLoadedMetadata)
    audio.addEventListener("timeupdate", onTimeUpdate)
    audio.addEventListener("ended", onEnded)
    audio.addEventListener("play", onPlay)
    audio.addEventListener("pause", onPause)

    return () => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata)
      audio.removeEventListener("timeupdate", onTimeUpdate)
      audio.removeEventListener("ended", onEnded)
      audio.removeEventListener("play", onPlay)
      audio.removeEventListener("pause", onPause)
    }
  }, [])

  // Reset state when the source changes.
  useEffect(() => {
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
  }, [src])

  // Keep the underlying element's volume in sync.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = volume
    audio.muted = isMuted
  }, [volume, isMuted])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      void audio.play()
    } else {
      audio.pause()
    }
  }

  const handleVolume = (value: Array<number>) => {
    const next = value[0] ?? 0
    setVolume(next)
    setIsMuted(next === 0)
  }

  const effectiveVolume = isMuted ? 0 : volume

  return (
    <div
      className={cn("relative aspect-square w-full overflow-hidden", className)}
    >
      {/* Moving gradient background - freezes in place when paused */}
      <style>{`@keyframes audioGradientPan {0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}`}</style>
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(120deg, oklch(0.77 0.22 148), oklch(0.72 0.18 175), oklch(0.62 0.16 205), oklch(0.70 0.20 135), oklch(0.77 0.22 148))",
          backgroundSize: "300% 300%",
          animationName: "audioGradientPan",
          animationDuration: "8s",
          animationTimingFunction: "ease-in-out",
          animationIterationCount: "infinite",
          animationPlayState: isPlaying ? "running" : "paused",
        }}
      />
      {/* Soft dark vignette for contrast */}
      <div className="absolute inset-0 bg-linear-to-b from-black/10 via-transparent to-black/30" />

      <audio ref={audioRef} src={src} preload="metadata" />

      {title && (
        <span className="absolute right-4 top-4 z-10 max-w-[60%] truncate text-sm font-medium tracking-wide text-white/90 drop-shadow">
          {title}
        </span>
      )}

      {/* Center play/pause with ring waves */}
      <div className="absolute inset-0 flex items-center justify-center w-full">
        <div className="relative flex items-center justify-center w-full">
          {/* Expanding ring waves while playing */}
          {isPlaying &&
            [0, 1, 2].map((i) => (
              <motion.span
                key={`ring-${i}`}
                className="absolute rounded-full border border-white/40"
                style={{ width: 80, height: 80 }}
                initial={{ scale: 1, opacity: 0 }}
                animate={{ scale: 2.4, opacity: [0, 0.5, 0] }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeOut",
                  delay: i,
                }}
              />
            ))}

          <motion.button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? "Pause" : "Play"}
            whileTap={{ scale: 0.92 }}
            className="relative z-10 flex aspect-square w-1/2 max-w-20 items-center justify-center rounded-full bg-white/90 text-emerald-900 shadow-lg backdrop-blur-sm transition-colors hover:bg-white"
          >
            {isPlaying ? (
              <Pause className="size-8 fill-current" />
            ) : (
              <Play className="size-8 translate-x-0.5 fill-current" />
            )}
          </motion.button>
        </div>
      </div>

      {/* Timer - top left */}
      <span className="absolute left-2 top-2 z-5 font-mono text-xs tabular-nums text-white/90 drop-shadow">
        {timeDisplay === "elapsed"
          ? `${formatTime(currentTime)} / ${formatTime(duration)}`
          : `${formatTime(Math.max(0, duration - currentTime))}`}
      </span>

      {/* Volume - bottom right */}
      <div className="absolute bottom-0 right-0 z-5">
        {/* Volume: icon is the anchor; slider expands to its left (absolute, no layout shift) */}
        <div className="relative flex size-9 items-center justify-center">
          <AnimatePresence initial={false}>
            {showVolume && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 112, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="absolute right-full mr-1 flex h-8 items-center overflow-hidden rounded-full bg-black/25 backdrop-blur-sm"
              >
                <Slider
                  value={[effectiveVolume]}
                  max={1}
                  step={0.01}
                  onValueChange={handleVolume}
                  aria-label="Volume"
                  className="mx-4 w-20 **:data-[slot=slider-thumb]:size-4 **:data-[slot=slider-track]:h-0.5"
                />
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="button"
            onClick={() => setShowVolume((prev) => !prev)}
            aria-label="Volume"
            className="flex size-6 shrink-0 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-sm transition-colors hover:bg-black/35"
          >
            {effectiveVolume === 0 ? (
              <VolumeX className="size-4" />
            ) : (
              <Volume2 className="size-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
