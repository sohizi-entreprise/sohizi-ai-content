import { RENDER_LIMITS } from "@sohizi/video-composition"

/** Wall-clock cap for a composition. Matches the export limit. */
export const MAX_TIMELINE_SECONDS = RENDER_LIMITS.maxDurationSeconds

export const TIMELINE_CAP_MESSAGE = "Timelines are limited to 20 minutes."

export interface ClipRange {
  startFrame: number
  endFrame: number
}

export function maxTimelineFrames(fps: number): number {
  const safeFps = Number.isFinite(fps) && fps > 0 ? fps : 1
  return Math.max(1, Math.floor(safeFps * MAX_TIMELINE_SECONDS))
}

export function clampTimelineDuration(frames: number, fps: number): number {
  const maxFrame = maxTimelineFrames(fps)
  if (!Number.isFinite(frames)) return 1
  return Math.min(maxFrame, Math.max(1, Math.floor(frames)))
}

/**
 * Keep the clip's start. Trim the end so it stays inside the timeline.
 * Returns null when the start is already at or past the cap.
 */
export function clampClipEnd(
  startFrame: number,
  endFrame: number,
  fps: number,
): ClipRange | null {
  const maxFrame = maxTimelineFrames(fps)
  const start = Math.max(0, Math.floor(startFrame))
  if (start >= maxFrame) return null
  const end = Math.min(maxFrame, Math.max(start + 1, Math.floor(endFrame)))
  return { startFrame: start, endFrame: end }
}

/**
 * Keep the clip's length. Slide it left when it would hang past the cap.
 * A clip longer than the timeline is trimmed to the full 20 minutes.
 */
export function clampClipMove(
  startFrame: number,
  length: number,
  fps: number,
): ClipRange {
  const maxFrame = maxTimelineFrames(fps)
  const span = Math.max(1, Math.floor(length))
  if (span >= maxFrame) {
    return { startFrame: 0, endFrame: maxFrame }
  }
  let start = Math.max(0, Math.floor(startFrame))
  if (start + span > maxFrame) start = maxFrame - span
  return { startFrame: start, endFrame: start + span }
}
