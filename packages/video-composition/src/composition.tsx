import { AbsoluteFill, Sequence } from 'remotion'
import {
  AudioClipRenderer,
  ImageClipRenderer,
  TextClipRenderer,
  VideoClipRenderer,
} from './clips'
import { HyperframeSequence } from './html-clip'
import { CaptionsRenderer } from './caption-clip'
import type { Clip, Track } from './types'

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
                  <ClipRouter clip={clip} track={track} />
                </Sequence>
              )
            })}
          </AbsoluteFill>
        )
      })}
    </AbsoluteFill>
  )
}

function ClipRouter({ clip, track }: { clip: Clip; track: Track }) {
  switch (clip.type) {
    case 'video':
      return <VideoClipRenderer clip={clip} muted={track.muted} />
    case 'audio':
      return <AudioClipRenderer clip={clip} muted={track.muted} />
    case 'image':
      return <ImageClipRenderer clip={clip} />
    case 'text':
      return <TextClipRenderer clip={clip} />
    case 'html':
      return <HyperframeSequence clip={clip} />
    case 'caption':
      return <CaptionsRenderer clip={clip} />
    default:
      return null
  }
}
