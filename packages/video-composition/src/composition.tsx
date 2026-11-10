import { useMemo } from "react"
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion"
import {
  AudioClipRenderer,
  ImageClipRenderer,
  TextClipRenderer,
  VideoClipRenderer,
} from "./clips"
import { CaptionsRenderer } from "./caption-clip"
import type { Clip, Track } from "./types"

export type MainCompositionProps = {
  tracks: Array<Track>
  [key: string]: unknown
}

/**
 * Target lookahead duration (in seconds) to premount upcoming media clips in
 * the `<Player>` preview so `<video>` / `<audio>` elements have already fetched
 * metadata, seeked to `sourceStartFrame`, and decoded their first frame before
 * the cut arrives. Ignored automatically by Remotion during server renders.
 */
export const PREMOUNT_LEAD_TIME_SECONDS = 1.5

/**
 * Upper bound on how many upcoming clips on the same track can be in the
 * premounting state simultaneously, protecting the browser's hardware media
 * decoder pool on large timelines with rapid cuts.
 */
export const MAX_CONCURRENT_PREMOUNTS_PER_TRACK = 2

function isPremountableMediaClip(clip: Clip, track: Track): boolean {
  if (track.muted && clip.type === "audio") return false
  return clip.type === "video" || clip.type === "audio"
}

export function computeTrackClipPremounts(
  track: Track,
  fps: number,
): Map<string, number> {
  const premountByClipId = new Map<string, number>()
  if (track.hidden || (track.type === "audio" && track.muted)) {
    return premountByClipId
  }

  const safeFps = Number.isFinite(fps) && fps > 0 ? fps : 30
  const targetPremountFrames = Math.max(
    1,
    Math.ceil(safeFps * PREMOUNT_LEAD_TIME_SECONDS),
  )

  const mediaClips = track.clips
    .filter((clip) => isPremountableMediaClip(clip, track))
    .slice()
    .sort((a, b) => a.startFrame - b.startFrame)

  for (let i = 0; i < mediaClips.length; i += 1) {
    const clip = mediaClips[i]
    if (clip.startFrame <= 0) continue

    const anchorIndex = i - MAX_CONCURRENT_PREMOUNTS_PER_TRACK
    const earliestPremountFrame =
      anchorIndex >= 0 ? Math.max(0, mediaClips[anchorIndex].startFrame) : 0
    const maxAllowedPremount = Math.max(
      0,
      clip.startFrame - earliestPremountFrame,
    )
    const premountFrames = Math.min(targetPremountFrames, maxAllowedPremount)
    if (premountFrames > 0) {
      premountByClipId.set(clip.id, premountFrames)
    }
  }

  return premountByClipId
}

export function MainComposition({ tracks }: MainCompositionProps) {
  const { fps } = useVideoConfig()

  // Render tracks in reverse so that tracks[0] (top of the timeline panel)
  // ends up as the last DOM sibling and therefore paints on top of all
  // tracks below it. This matches the convention used by Premiere, Final
  // Cut, After Effects, etc.: higher track in the panel = closer to the
  // camera in the composition. Audio is unaffected (it always mixes).
  const preparedTracks = useMemo(() => {
    const orderedTracks = [...tracks].reverse()

    return orderedTracks.flatMap((track) => {
      if (track.hidden) return []
      if (track.type === "audio" && track.muted) return []

      return [
        {
          track,
          premountByClipId: computeTrackClipPremounts(track, fps),
        },
      ]
    })
  }, [tracks, fps])

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {preparedTracks.map(({ track, premountByClipId }) => (
        <AbsoluteFill key={track.id}>
          {track.clips.map((clip) => {
            const durationInFrames = Math.max(
              1,
              clip.endFrame - clip.startFrame,
            )
            const premountFor = premountByClipId.get(clip.id)
            return (
              <Sequence
                key={clip.id}
                from={clip.startFrame}
                durationInFrames={durationInFrames}
                premountFor={premountFor}
                layout="absolute-fill"
              >
                <ClipRouter clip={clip} track={track} />
              </Sequence>
            )
          })}
        </AbsoluteFill>
      ))}
    </AbsoluteFill>
  )
}

function ClipRouter({ clip, track }: { clip: Clip; track: Track }) {
  switch (clip.type) {
    case "video":
      return <VideoClipRenderer clip={clip} muted={track.muted} />
    case "audio":
      return <AudioClipRenderer clip={clip} muted={track.muted} />
    case "image":
      return <ImageClipRenderer clip={clip} />
    case "text":
      return <TextClipRenderer clip={clip} />
    case "caption":
      return <CaptionsRenderer clip={clip} />
    default:
      return null
  }
}
