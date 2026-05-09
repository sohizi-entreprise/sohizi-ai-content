import { useEffect, useMemo } from 'react'
import { Player } from '@remotion/player'
import { useVideoEditorStore } from '../store/editor-store'
import { MainComposition } from './composition'
import { usePlayerRef } from './player-ref'
import type { CallbackListener } from '@remotion/player'
import type { MainCompositionProps } from './composition'

interface VideoEditorPlayerProps {
  className?: string
}

export function VideoEditorPlayer({ className }: VideoEditorPlayerProps) {
  const playerRef = usePlayerRef()

  const fps = useVideoEditorStore((s) => s.fps)
  const durationInFrames = useVideoEditorStore((s) => s.durationInFrames)
  const width = useVideoEditorStore((s) => s.width)
  const height = useVideoEditorStore((s) => s.height)
  const tracks = useVideoEditorStore((s) => s.tracks)

  const setCurrentFrame = useVideoEditorStore((s) => s.setCurrentFrame)
  const setIsPlaying = useVideoEditorStore((s) => s.setIsPlaying)

  const inputProps = useMemo<MainCompositionProps>(() => ({ tracks }), [tracks])

  useEffect(() => {
    const player = playerRef.current
    if (!player) return

    const onFrame: CallbackListener<'frameupdate'> = (e) => {
      setCurrentFrame(e.detail.frame)
    }
    const onPlay: CallbackListener<'play'> = () => setIsPlaying(true)
    const onPause: CallbackListener<'pause'> = () => setIsPlaying(false)
    const onEnded: CallbackListener<'ended'> = () => setIsPlaying(false)

    player.addEventListener('frameupdate', onFrame)
    player.addEventListener('play', onPlay)
    player.addEventListener('pause', onPause)
    player.addEventListener('ended', onEnded)

    return () => {
      player.removeEventListener('frameupdate', onFrame)
      player.removeEventListener('play', onPlay)
      player.removeEventListener('pause', onPause)
      player.removeEventListener('ended', onEnded)
    }
  }, [playerRef, setCurrentFrame, setIsPlaying])

  return (
    <div className={className} style={{ width: '100%', height: '100%' }}>
      <Player
        ref={playerRef}
        component={MainComposition}
        inputProps={inputProps}
        durationInFrames={Math.max(1, durationInFrames)}
        compositionWidth={width}
        compositionHeight={height}
        fps={fps}
        controls={false}
        clickToPlay={false}
        doubleClickToFullscreen={false}
        spaceKeyToPlayOrPause={false}
        style={{ width: '100%', height: '100%' }}
        acknowledgeRemotionLicense
      />
    </div>
  )
}
