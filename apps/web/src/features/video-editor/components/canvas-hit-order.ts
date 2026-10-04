import { isCanvasEditableClip } from "../store/types"
import type { CanvasEditableClip, Track } from "../store/types"

export interface CanvasHitTarget {
  clip: CanvasEditableClip
  /** Higher values sit closer to the viewer. */
  zIndex: number
}

/**
 * Hit targets in back-to-front order.
 *
 * `tracks[0]` is the top row of the timeline and the layer closest to the
 * camera, matching `MainComposition`. Later clips on the same track paint
 * above earlier ones. The returned `zIndex` rises toward the front so a
 * lower track cannot steal clicks from a track above it.
 */
export function listCanvasHitTargets(
  tracks: Array<Track>,
  currentFrame: number,
): Array<CanvasHitTarget> {
  const result: Array<CanvasHitTarget> = []
  let zIndex = 1

  for (let i = tracks.length - 1; i >= 0; i--) {
    const track = tracks[i]
    if (!track || track.hidden) continue
    for (const clip of track.clips) {
      if (!isCanvasEditableClip(clip)) continue
      if (currentFrame < clip.startFrame || currentFrame >= clip.endFrame) {
        continue
      }
      result.push({ clip, zIndex })
      zIndex += 1
    }
  }

  return result
}
