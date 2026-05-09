import { AbsoluteFill, Sequence } from 'remotion'
import {
  AudioClipRenderer,
  ImageClipRenderer,
  TextClipRenderer,
  VideoClipRenderer,
} from './clips'
import type { Track } from '../store/types'

export type MainCompositionProps = {
  tracks: Array<Track>
  [key: string]: unknown
}

export function MainComposition({ tracks }: MainCompositionProps) {
  // Render tracks in reverse so that tracks[0] (top of the timeline panel)
  // ends up as the last DOM sibling and therefore paints on top of all
  // tracks below it. This matches the convention used by Premiere, Final
  // Cut, After Effects, etc.: higher track in the panel = closer to the
  // camera in the composition. Audio is unaffected (it always mixes).
  const orderedTracks = [...tracks].reverse()
  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      {orderedTracks.map((track) => {
        if (track.hidden) return null
        return (
          <AbsoluteFill key={track.id}>
            {track.clips.map((clip) => {
              const durationInFrames = Math.max(
                1,
                clip.endFrame - clip.startFrame,
              )
              return (
                <Sequence
                  key={clip.id}
                  from={clip.startFrame}
                  durationInFrames={durationInFrames}
                  layout="absolute-fill"
                >
                  {clip.type === 'video' ? (
                    <VideoClipRenderer clip={clip} muted={track.muted} />
                  ) : clip.type === 'audio' ? (
                    <AudioClipRenderer clip={clip} muted={track.muted} />
                  ) : clip.type === 'image' ? (
                    <ImageClipRenderer clip={clip} />
                  ) : (
                    <TextClipRenderer clip={clip} />
                  )}
                </Sequence>
              )
            })}
          </AbsoluteFill>
        )
      })}
    </AbsoluteFill>
  )
}
