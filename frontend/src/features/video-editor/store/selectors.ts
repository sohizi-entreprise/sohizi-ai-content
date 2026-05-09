import { framesToSeconds, secondsToFrames } from '../utils/time'
import type { TimelineAction, TimelineRow } from '@xzdarcy/timeline-engine'
import type { Clip, ProjectState, Track } from './types'

export interface VisibleEditorData {
  rows: Array<TimelineRow>
  trackById: Record<string, Track | undefined>
  clipById: Record<string, Clip | undefined>
}

export const CLIP_EFFECT_IDS = {
  video: 'effect_video_clip',
  audio: 'effect_audio_clip',
  text: 'effect_text_clip',
  image: 'effect_image_clip',
} as const

export function selectVisibleClips(
  state: ProjectState,
  bufferFrames = 50,
): VisibleEditorData {
  const { fps, viewport, tracks, selection } = state

  const viewStartFrame = secondsToFrames(viewport.startSec, fps) - bufferFrames
  const viewEndFrame = secondsToFrames(viewport.endSec, fps) + bufferFrames

  const trackById: Record<string, Track> = {}
  const clipById: Record<string, Clip> = {}
  const selectedSet = new Set(selection.clipIds)

  const rows: Array<TimelineRow> = tracks.map((track) => {
    trackById[track.id] = track

    const visibleActions: Array<TimelineAction> = []
    for (const clip of track.clips) {
      if (clip.endFrame < viewStartFrame) continue
      if (clip.startFrame > viewEndFrame) continue

      clipById[clip.id] = clip
      const start = framesToSeconds(clip.startFrame, fps)
      const end = framesToSeconds(clip.endFrame, fps)

      visibleActions.push({
        id: clip.id,
        start,
        end,
        effectId: CLIP_EFFECT_IDS[clip.type],
        movable: true,
        flexible: true,
        selected: selectedSet.has(clip.id),
      })
    }

    return {
      id: track.id,
      actions: visibleActions,
      classNames: track.hidden ? ['ve-track-hidden'] : [],
    }
  })

  return { rows, trackById, clipById }
}
