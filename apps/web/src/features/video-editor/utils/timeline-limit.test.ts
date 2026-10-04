import { describe, expect, it } from "vitest"
import {
  MAX_TIMELINE_SECONDS,
  clampClipEnd,
  clampClipMove,
  clampTimelineDuration,
  maxTimelineFrames,
} from "./timeline-limit"

const FPS = 30
const MAX_FRAME = FPS * MAX_TIMELINE_SECONDS

describe("timeline limit", () => {
  it("caps the timeline at 20 minutes", () => {
    expect(MAX_TIMELINE_SECONDS).toBe(20 * 60)
    expect(maxTimelineFrames(FPS)).toBe(MAX_FRAME)
    expect(clampTimelineDuration(FPS * 60 * 30, FPS)).toBe(MAX_FRAME)
    expect(clampTimelineDuration(FPS * 10, FPS)).toBe(FPS * 10)
  })

  it("trims a clip that would end after 20 minutes", () => {
    expect(clampClipEnd(0, FPS * 60 * 30, FPS)).toEqual({
      startFrame: 0,
      endFrame: MAX_FRAME,
    })
    expect(
      clampClipEnd(MAX_FRAME - FPS * 30, MAX_FRAME + FPS * 60, FPS),
    ).toEqual({
      startFrame: MAX_FRAME - FPS * 30,
      endFrame: MAX_FRAME,
    })
  })

  it("rejects a clip that starts at the cap", () => {
    expect(clampClipEnd(MAX_FRAME, MAX_FRAME + FPS, FPS)).toBeNull()
  })

  it("slides a moved clip back so it stays inside 20 minutes", () => {
    expect(clampClipMove(MAX_FRAME - FPS, FPS * 10, FPS)).toEqual({
      startFrame: MAX_FRAME - FPS * 10,
      endFrame: MAX_FRAME,
    })
  })
})
