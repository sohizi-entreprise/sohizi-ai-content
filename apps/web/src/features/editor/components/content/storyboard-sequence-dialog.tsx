import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react"
import { Player } from "@remotion/player"
import { ChevronLeft, ChevronRight, ImageIcon, Pause, Play } from "lucide-react"
import { MainComposition } from "@sohizi/video-composition"
import {
  aspectRatioToCss,
  aspectRatioToDimensions,
} from "../../extensions/storyboard"
import type { StoryboardAspectRatio } from "../../extensions/storyboard"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@sohizi/ui/dialog"
import {
  SEQUENCE_FRAMES_PER_SHOT,
  buildStoryboardSequence,
  shotIndexFromFrame,
} from "../../extensions/storyboard/storyboard-sequence"
import type { SequenceShot } from "../../extensions/storyboard/storyboard-sequence"
import type { CallbackListener, PlayerRef } from "@remotion/player"
import type { MainCompositionProps } from "@sohizi/video-composition"
import { thumbnailImageUrl } from "@/utils/transform-url"

type SequenceMode = "slides" | "video"

type StoryboardSequenceDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  shots: Array<SequenceShot>
  aspectRatio: StoryboardAspectRatio
}

export function StoryboardSequenceDialog({
  open,
  onOpenChange,
  shots,
  aspectRatio,
}: StoryboardSequenceDialogProps) {
  const { width, height } = aspectRatioToDimensions(aspectRatio)
  const aspectCss = aspectRatioToCss(aspectRatio)
  const playerRef = useRef<PlayerRef>(null)
  const [mode, setMode] = useState<SequenceMode>("slides")
  const [slideIndex, setSlideIndex] = useState(0)
  const [frame, setFrame] = useState(0)
  const [playing, setPlaying] = useState(false)

  const composition = useMemo(() => buildStoryboardSequence(shots), [shots])
  const inputProps = useMemo<MainCompositionProps>(
    () => ({ tracks: composition.tracks }),
    [composition.tracks],
  )

  const videoIndex = shotIndexFromFrame(frame, shots.length)
  const activeIndex = mode === "slides" ? slideIndex : videoIndex
  const current = shots.length > 0 ? shots[activeIndex] : undefined
  const counter = current
    ? `Scene ${current.sceneNumber} · Shot ${current.shotNumber}`
    : "No shots"
  const lastIndex = Math.max(shots.length - 1, 0)

  const goToSlide = useCallback(
    (index: number) => {
      setSlideIndex(Math.min(Math.max(index, 0), lastIndex))
    },
    [lastIndex],
  )

  const seekToShot = useCallback(
    (index: number) => {
      const next = Math.min(Math.max(index, 0), lastIndex)
      playerRef.current?.seekTo(next * SEQUENCE_FRAMES_PER_SHOT)
    },
    [lastIndex],
  )

  const togglePlayback = useCallback(() => {
    const player = playerRef.current
    if (!player) return
    if (player.isPlaying()) player.pause()
    else player.play()
  }, [])

  const selectMode = useCallback(
    (nextMode: SequenceMode) => {
      if (nextMode === mode) return
      if (mode === "video") {
        playerRef.current?.pause()
        setSlideIndex(videoIndex)
      }
      setMode(nextMode)
    },
    [mode, videoIndex],
  )

  useEffect(() => {
    if (open) return
    setMode("slides")
    setSlideIndex(0)
    setFrame(0)
    setPlaying(false)
  }, [open])

  useEffect(() => {
    if (!open || mode !== "video") return

    const player = playerRef.current
    if (!player) return

    const onFrame: CallbackListener<"frameupdate"> = (event) => {
      setFrame(event.detail.frame)
    }
    const onPlay: CallbackListener<"play"> = () => setPlaying(true)
    const onPause: CallbackListener<"pause"> = () => setPlaying(false)
    const onEnded: CallbackListener<"ended"> = () => setPlaying(false)

    player.addEventListener("frameupdate", onFrame)
    player.addEventListener("play", onPlay)
    player.addEventListener("pause", onPause)
    player.addEventListener("ended", onEnded)
    player.seekTo(slideIndex * SEQUENCE_FRAMES_PER_SHOT)

    return () => {
      player.removeEventListener("frameupdate", onFrame)
      player.removeEventListener("play", onPlay)
      player.removeEventListener("pause", onPause)
      player.removeEventListener("ended", onEnded)
      player.pause()
    }
  }, [open, mode, composition.durationInFrames])

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === " " || event.code === "Space") {
        event.preventDefault()
        if (mode === "video") togglePlayback()
        else goToSlide(slideIndex + 1)
        return
      }
      if (event.key === "ArrowRight") {
        event.preventDefault()
        if (mode === "video") seekToShot(videoIndex + 1)
        else goToSlide(slideIndex + 1)
        return
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault()
        if (mode === "video") seekToShot(videoIndex - 1)
        else goToSlide(slideIndex - 1)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [
    goToSlide,
    mode,
    open,
    seekToShot,
    slideIndex,
    togglePlayback,
    videoIndex,
  ])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[90vh] max-h-[90vh] w-full max-w-[calc(100%-2rem)] flex-col bg-surface/30 p-4 backdrop-blur-sm sm:max-w-5xl md:max-w-6xl"
        style={{ "--storyboard-aspect": aspectCss } as CSSProperties}
      >
        <DialogTitle className="sr-only">Storyboard sequence</DialogTitle>
        <DialogDescription className="sr-only">
          Review shots as slides or play them as a video with subtitles.
        </DialogDescription>

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-black">
          <div className="storyboard-sequence-modes" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "slides"}
              className={
                mode === "slides"
                  ? "storyboard-sequence-mode storyboard-sequence-mode-active"
                  : "storyboard-sequence-mode"
              }
              onClick={() => selectMode("slides")}
            >
              Slides
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "video"}
              className={
                mode === "video"
                  ? "storyboard-sequence-mode storyboard-sequence-mode-active"
                  : "storyboard-sequence-mode"
              }
              onClick={() => selectMode("video")}
            >
              Video
            </button>
          </div>

          {mode === "slides" ? (
            <SequenceSlide shot={current} />
          ) : (
            <Player
              ref={playerRef}
              component={MainComposition}
              inputProps={inputProps}
              durationInFrames={composition.durationInFrames}
              compositionWidth={width}
              compositionHeight={height}
              fps={composition.fps}
              controls={false}
              clickToPlay
              doubleClickToFullscreen={false}
              spaceKeyToPlayOrPause={false}
              style={{ width: "100%", height: "100%" }}
              acknowledgeRemotionLicense
            />
          )}

          <div className="storyboard-sequence-remote">
            {mode === "video" ? (
              <button
                type="button"
                className="storyboard-sequence-play"
                onClick={togglePlayback}
                aria-label={playing ? "Pause sequence" : "Play sequence"}
                title={playing ? "Pause" : "Play"}
              >
                {playing ? (
                  <Pause className="size-4 fill-current" />
                ) : (
                  <Play className="size-4 fill-current" />
                )}
              </button>
            ) : null}
            <button
              type="button"
              className="storyboard-sequence-nav"
              onClick={() =>
                mode === "video"
                  ? seekToShot(videoIndex - 1)
                  : goToSlide(slideIndex - 1)
              }
              disabled={activeIndex <= 0}
              aria-label="Previous shot"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="storyboard-sequence-counter">{counter}</span>
            <button
              type="button"
              className="storyboard-sequence-nav"
              onClick={() =>
                mode === "video"
                  ? seekToShot(videoIndex + 1)
                  : goToSlide(slideIndex + 1)
              }
              disabled={activeIndex >= lastIndex}
              aria-label="Next shot"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SequenceSlide({ shot }: { shot: SequenceShot | undefined }) {
  if (!shot) {
    return (
      <div className="storyboard-sequence-slide">
        <div className="storyboard-sequence-slide-empty">
          <ImageIcon className="size-8" />
          <span>No shots to preview</span>
        </div>
      </div>
    )
  }

  return (
    <div className="storyboard-sequence-slide">
      <div className="storyboard-sequence-slide-frame">
        {shot.image ? (
          <img
            src={thumbnailImageUrl(shot.image, "large")}
            alt={shot.subtitle || "Shot"}
          />
        ) : (
          <div className="storyboard-sequence-slide-empty">
            <ImageIcon className="size-8" />
          </div>
        )}
      </div>
      {shot.subtitle ? (
        <p className="storyboard-sequence-subtitle">{shot.subtitle}</p>
      ) : null}
    </div>
  )
}
