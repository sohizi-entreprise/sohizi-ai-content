import { useEffect, useEffectEvent, useRef, useState } from "react"
import { useReducedMotion } from "motion/react"
import { Play } from "lucide-react"
import { captureAnalyticsEvent } from "@sohizi/analytics/browser"
import { cn } from "@/lib/utils"

type DemoVideoProps = {
  src: string
  /** Preferred source on desktop / large screens. */
  hdSrc?: string
  /** Shown while paused / before playback. */
  poster?: string
  className?: string
  videoClassName?: string
  /** Load earlier / buffer more aggressively (hero). */
  priority?: boolean
  /** When false, pause and stop requesting more media. */
  active?: boolean
  /** Autoplay muted in view, or wait for an explicit play. */
  playback?: "auto" | "manual"
  label?: string
  fit?: "cover" | "contain"
  /** Analytics location for manual play clicks. */
  location?: string
}

const HD_QUERY = "(min-width: 1024px)"

function usePreferredSrc(src: string, hdSrc?: string) {
  const [resolved, setResolved] = useState(src)

  useEffect(() => {
    if (!hdSrc || typeof window.matchMedia !== "function") {
      setResolved(src)
      return
    }

    const media = window.matchMedia(HD_QUERY)
    const sync = () => setResolved(media.matches ? hdSrc : src)
    sync()
    media.addEventListener("change", sync)
    return () => media.removeEventListener("change", sync)
  }, [src, hdSrc])

  return resolved
}

/**
 * Progressive, viewport-aware MP4 player.
 * Src is attached only near the viewport so the browser streams by Range
 * request instead of downloading every demo up front.
 */
export function DemoVideo({
  src,
  hdSrc,
  poster,
  className,
  videoClassName,
  priority = false,
  active = true,
  playback = "auto",
  label,
  fit = "cover",
  location = "unknown",
}: DemoVideoProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const reduceMotion = useReducedMotion()
  const preferredSrc = usePreferredSrc(src, hdSrc)
  const [nearView, setNearView] = useState(priority)
  const [inView, setInView] = useState(false)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [buffered, setBuffered] = useState(0)
  const [playing, setPlaying] = useState(false)

  const manual = playback === "manual"
  const shouldLoad = nearView && active
  const shouldAutoPlay = !manual && active && inView && !reduceMotion && !failed

  useEffect(() => {
    const node = rootRef.current
    if (!node || typeof IntersectionObserver === "undefined") {
      setNearView(true)
      setInView(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry.isIntersecting) setNearView(true)
        setInView(entry.isIntersecting)
      },
      {
        rootMargin: priority ? "280px 0px" : "160px 0px",
        threshold: 0.15,
      },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [priority])

  const syncPlayback = useEffectEvent((play: boolean) => {
    const video = videoRef.current
    if (!video) return
    if (play) {
      void video.play().catch(() => {})
      return
    }
    video.pause()
  })

  const updateBuffered = useEffectEvent(() => {
    const video = videoRef.current
    if (!video || !video.duration || !Number.isFinite(video.duration)) return
    let end = 0
    for (let i = 0; i < video.buffered.length; i += 1) {
      end = Math.max(end, video.buffered.end(i))
    }
    setBuffered(Math.min(1, end / video.duration))
  })

  useEffect(() => {
    if (manual) {
      if (!active || !inView) syncPlayback(false)
      return
    }
    syncPlayback(shouldAutoPlay && ready)
  }, [manual, active, inView, shouldAutoPlay, ready])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !shouldLoad) return
    if (video.dataset.loadedSrc === preferredSrc) return
    video.dataset.loadedSrc = preferredSrc
    video.src = preferredSrc
    setReady(false)
    setBuffered(0)
    setPlaying(false)
    video.load()
  }, [shouldLoad, preferredSrc])

  useEffect(() => {
    if (shouldLoad) return
    const video = videoRef.current
    if (!video) return
    video.pause()
    if (video.dataset.loadedSrc) {
      video.removeAttribute("src")
      video.load()
      delete video.dataset.loadedSrc
      setReady(false)
      setBuffered(0)
      setPlaying(false)
    }
  }, [shouldLoad])

  const handlePlayClick = () => {
    const video = videoRef.current
    if (!video) return
    captureAnalyticsEvent("marketing_demo_played", { location })
    video.muted = false
    void video
      .play()
      .then(() => setPlaying(true))
      .catch(() => {})
  }

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative isolate overflow-hidden rounded-[1.1rem] bg-[#0b0f0e]",
        className,
      )}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 transition-opacity duration-700",
          ready || poster ? "opacity-0" : "opacity-100",
        )}
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, rgba(120,140,120,0.18), transparent 55%), linear-gradient(160deg, #151b19, #0a0e0d)",
        }}
      />

      {poster && (
        <img
          src={poster}
          alt=""
          aria-hidden
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          className={cn(
            "absolute inset-0 size-full transition-opacity duration-300",
            fit === "cover" ? "object-cover" : "object-contain bg-black",
            playing ? "opacity-0" : "opacity-100",
          )}
        />
      )}

      {!failed && (
        <video
          ref={videoRef}
          muted={!manual}
          loop={!manual}
          playsInline
          poster={poster}
          controls={manual && playing}
          preload="metadata"
          aria-label={label}
          onLoadedData={() => {
            setReady(true)
            updateBuffered()
          }}
          onCanPlay={() => setReady(true)}
          onProgress={updateBuffered}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onError={() => setFailed(true)}
          className={cn(
            "absolute inset-0 size-full transition-opacity duration-300",
            fit === "cover" ? "object-cover" : "object-contain bg-black",
            playing || (!poster && ready) ? "opacity-100" : "opacity-0",
            videoClassName,
          )}
        />
      )}

      {failed && (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
          <p className="text-sm text-white/45">Demo unavailable right now.</p>
        </div>
      )}

      {manual && !playing && !failed && (
        <button
          type="button"
          onClick={handlePlayClick}
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 transition hover:bg-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          aria-label="Play demo video"
        >
          <span className="flex size-16 items-center justify-center rounded-full border border-white/25 bg-black/50 text-white backdrop-blur-sm sm:size-[4.5rem]">
            <Play className="size-6 fill-white sm:size-7" />
          </span>
        </button>
      )}

      {shouldLoad && !ready && !failed && !poster && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px overflow-hidden bg-white/10"
        >
          <div
            className="h-full bg-white/45 transition-[width] duration-300 ease-out"
            style={{ width: `${Math.max(8, buffered * 100)}%` }}
          />
        </div>
      )}
    </div>
  )
}
