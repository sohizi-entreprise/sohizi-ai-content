import { describe, expect, it } from "vitest"
import { listCanvasHitTargets } from "./canvas-hit-order"
import type { TextClip, Track } from "../store/types"

function textClip(id: string, start = 0, end = 30): TextClip {
  return {
    id,
    trackId: "t",
    type: "text",
    startFrame: start,
    endFrame: end,
    sourceStartFrame: 0,
    sourceDurationInFrames: end - start,
    text: id,
    fontSize: 24,
    color: "#fff",
    fontFamily: "sans",
    fontWeight: "normal",
    align: "center",
    opacity: 1,
    xRatio: 0.5,
    yRatio: 0.5,
    widthRatio: 0.4,
    heightRatio: 0.2,
  }
}

function track(id: string, clips: Track["clips"], hidden = false): Track {
  return { id, type: "text", name: id, muted: false, hidden, clips }
}

describe("listCanvasHitTargets", () => {
  it("puts the top timeline track in front of tracks below it", () => {
    const targets = listCanvasHitTargets(
      [
        track("top", [textClip("front")]),
        track("bottom", [textClip("back")]),
      ],
      0,
    )

    expect(targets.map((target) => target.clip.id)).toEqual(["back", "front"])
    expect(targets.map((target) => target.zIndex)).toEqual([1, 2])
  })

  it("paints later clips on the same track above earlier ones", () => {
    const targets = listCanvasHitTargets(
      [
        track("top", [textClip("a"), textClip("b")]),
        track("bottom", [textClip("c")]),
      ],
      0,
    )

    expect(targets.map((target) => target.clip.id)).toEqual(["c", "a", "b"])
    expect(targets.at(-1)?.zIndex).toBeGreaterThan(targets[0]?.zIndex ?? 0)
  })

  it("skips hidden tracks, audio, and clips outside the playhead", () => {
    const targets = listCanvasHitTargets(
      [
        track("top", [textClip("visible"), textClip("later", 40, 50)]),
        track("hidden", [textClip("hidden-clip")], true),
        track("audio", [
          {
            id: "audio",
            trackId: "audio",
            type: "audio",
            startFrame: 0,
            endFrame: 30,
            sourceStartFrame: 0,
            sourceDurationInFrames: 30,
            url: "a.mp3",
            fileName: "a.mp3",
            volume: 1,
            speed: 1,
          },
        ]),
      ],
      0,
    )

    expect(targets.map((target) => target.clip.id)).toEqual(["visible"])
  })
})
