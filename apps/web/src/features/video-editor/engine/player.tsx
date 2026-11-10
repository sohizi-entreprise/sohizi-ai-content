import { useEffect, useLayoutEffect, useMemo, useRef } from "react"
import { Player } from "@remotion/player"
import { MainComposition } from "@sohizi/video-composition"
import { useVideoEditorStore } from "../store/editor-store"
import { useVideoEditorUiStore } from "../store/ui-store"
import { usePlayerRef } from "./player-ref"
import type { CallbackListener } from "@remotion/player"
import type { MainCompositionProps } from "@sohizi/video-composition"
import {
  buildOptimizeddImageUrl,
  imageUrlTransforms,
} from "@/utils/transform-url"

interface VideoEditorPlayerProps {
  className?: string
}

const PLAYER_STYLE = { width: "100%", height: "100%" } as const
const SHARED_AUDIO_TAGS_POOL_SIZE = 16

export function VideoEditorPlayer({ className }: VideoEditorPlayerProps) {
  const playerRef = usePlayerRef()

  const fps = useVideoEditorStore((s) => s.fps)
  const durationInFrames = useVideoEditorStore((s) => s.durationInFrames)
  const width = useVideoEditorStore((s) => s.width)
  const height = useVideoEditorStore((s) => s.height)
  const tracks = useVideoEditorStore((s) => s.tracks)
  const playbackRate = useVideoEditorUiStore((s) => s.playbackRate)
  const fpsRef = useRef(fps)

  const setCurrentFrame = useVideoEditorStore((s) => s.setCurrentFrame)
  const setIsPlaying = useVideoEditorStore((s) => s.setIsPlaying)

  const inputProps = useMemo<MainCompositionProps>(
    () => ({
      tracks: tracks.map((track) =>
        track.type === "image"
          ? {
              ...track,
              clips: track.clips.map((clip) =>
                clip.type === "image"
                  ? {
                      ...clip,
                      url: buildOptimizeddImageUrl(
                        clip.url,
                        imageUrlTransforms.fullscreen.hdDesktop,
                      ),
                    }
                  : clip,
              ),
            }
          : track,
      ),
    }),
    [tracks],
  )

  useEffect(() => {
    const player = playerRef.current
    if (!player) return

    const onFrame: CallbackListener<"frameupdate"> = (e) => {
      setCurrentFrame(e.detail.frame)
    }
    const onPlay: CallbackListener<"play"> = () => setIsPlaying(true)
    const onPause: CallbackListener<"pause"> = () => setIsPlaying(false)
    const onEnded: CallbackListener<"ended"> = () => setIsPlaying(false)

    player.addEventListener("frameupdate", onFrame)
    player.addEventListener("play", onPlay)
    player.addEventListener("pause", onPause)
    player.addEventListener("ended", onEnded)

    return () => {
      player.removeEventListener("frameupdate", onFrame)
      player.removeEventListener("play", onPlay)
      player.removeEventListener("pause", onPause)
      player.removeEventListener("ended", onEnded)
    }
  }, [playerRef, setCurrentFrame, setIsPlaying])

  useLayoutEffect(() => {
    if (fpsRef.current === fps) return
    fpsRef.current = fps
    playerRef.current?.seekTo(useVideoEditorStore.getState().currentFrame)
  }, [fps, playerRef])

  return (
    <div className={className} style={PLAYER_STYLE}>
      <Player
        ref={playerRef}
        component={MainComposition}
        inputProps={inputProps}
        durationInFrames={Math.max(1, durationInFrames)}
        compositionWidth={width}
        compositionHeight={height}
        fps={fps}
        playbackRate={playbackRate}
        numberOfSharedAudioTags={SHARED_AUDIO_TAGS_POOL_SIZE}
        controls={false}
        clickToPlay={false}
        doubleClickToFullscreen={false}
        spaceKeyToPlayOrPause={false}
        style={PLAYER_STYLE}
        acknowledgeRemotionLicense
      />
    </div>
  )
}
