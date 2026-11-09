import { beforeAll, describe, expect, it } from "vitest"
import { sceneToNode } from "./storyboard-nodes"
import {
  SEQUENCE_FPS,
  SEQUENCE_FRAMES_PER_SHOT,
  SEQUENCE_SHOT_SECONDS,
  buildStoryboardSequence,
  collectSequenceShotsFromJson,
  formatShotSubtitle,
  sceneAttachLabel,
  shotAttachLabel,
  shotIndexFromFrame,
} from "./storyboard-sequence"
import type { JSONContent } from "@tiptap/core"
import { setPublicEnv } from "@/lib/public-env"
import { thumbnailImageUrl } from "@/utils/transform-url"

beforeAll(() => {
  setPublicEnv({
    sentry: {
      dsn: "",
      environment: "local",
      enabled: false,
      tracesSampleRate: 0,
    },
    posthogProject: "",
    posthogApiHost: "",
    posthogApiVersion: "",
    siteUrl: "http://localhost:3000",
    mediaCdnUrl: "https://media.sohizi.com/cdn-cgi/image",
  })
})

const SAMPLE_DOC: JSONContent = {
  type: "doc",
  content: [
    sceneToNode({
      id: "scene-1",
      title: "Arrival",
      action: "",
      environment: "",
      lighting: "",
      shots: [
        {
          id: "shot-1",
          image: "/images/shot-1.jpg",
          action: "Wide establishing shot.",
        },
        {
          id: "shot-2",
          action: "Should be ignored.",
          dialogue: [{ speaker: "DETECTIVE", text: "Hello?" }],
          narration: "Ignored narration.",
        },
        {
          id: "shot-3",
          narration: "Someone was here recently.",
          action: "Close-up of a footprint.",
        },
      ],
    }),
    sceneToNode({
      id: "scene-2",
      title: "Departure",
      action: "",
      environment: "",
      lighting: "",
      shots: [{ id: "shot-4", action: "Exterior wide." }],
    }),
  ],
}

describe("formatShotSubtitle", () => {
  it("prefers dialogue over narration and ignores action", () => {
    expect(
      formatShotSubtitle({
        id: "shot",
        action: "walks in",
        narration: "A voice over",
        dialogue: [{ speaker: "DETECTIVE", text: "Hello?" }],
      }),
    ).toBe("DETECTIVE: Hello?")
  })

  it("falls back to narration and returns empty when only action is present", () => {
    expect(
      formatShotSubtitle({
        id: "shot",
        action: "walks in",
        narration: "A voice over",
      }),
    ).toBe("A voice over")
    expect(formatShotSubtitle({ id: "shot", action: "walks in" })).toBe("")
  })

  it("joins dialogue lines and skips empty ones", () => {
    expect(
      formatShotSubtitle({
        id: "shot",
        dialogue: [
          { speaker: "A", text: "One" },
          { speaker: "", text: "" },
          { speaker: "", text: "Two" },
        ],
      }),
    ).toBe("A: One\nTwo")
  })
})

describe("collectSequenceShotsFromJson", () => {
  it("numbers scenes and shots in document order", () => {
    const shots = collectSequenceShotsFromJson(SAMPLE_DOC)
    expect(shots).toHaveLength(4)
    expect(shots[0]).toMatchObject({
      sceneNumber: 1,
      shotNumber: 1,
      image: "/images/shot-1.jpg",
      subtitle: "",
    })
    expect(shots[1]).toMatchObject({
      sceneNumber: 1,
      shotNumber: 2,
      subtitle: "DETECTIVE: Hello?",
    })
    expect(shots[2]).toMatchObject({
      sceneNumber: 1,
      shotNumber: 3,
      subtitle: "Someone was here recently.",
    })
    expect(shots[3]).toMatchObject({
      sceneNumber: 2,
      shotNumber: 1,
      subtitle: "",
    })
  })
})

describe("buildStoryboardSequence", () => {
  it("builds one image clip per shot and duration from shot count", () => {
    const shots = collectSequenceShotsFromJson(SAMPLE_DOC)
    const composition = buildStoryboardSequence(shots)
    const imageTrack = composition.tracks.find(
      (track) => track.type === "image",
    )
    const textTrack = composition.tracks.find((track) => track.type === "text")

    expect(SEQUENCE_SHOT_SECONDS).toBe(3)
    expect(SEQUENCE_FRAMES_PER_SHOT).toBe(SEQUENCE_FPS * SEQUENCE_SHOT_SECONDS)
    expect(composition.fps).toBe(SEQUENCE_FPS)
    expect(composition.durationInFrames).toBe(4 * SEQUENCE_FRAMES_PER_SHOT)
    expect(imageTrack?.clips).toHaveLength(4)
    expect(textTrack?.clips).toHaveLength(2)
    expect(imageTrack?.clips[0]).toMatchObject({
      url: thumbnailImageUrl("/images/shot-1.jpg", "large"),
    })
    expect(imageTrack?.clips[1]).toMatchObject({
      startFrame: SEQUENCE_FRAMES_PER_SHOT,
      endFrame: SEQUENCE_FRAMES_PER_SHOT * 2,
    })
    expect(textTrack?.clips[0]).toMatchObject({
      text: "DETECTIVE: Hello?",
    })
  })

  it("keeps a one-frame composition when there are no shots", () => {
    const composition = buildStoryboardSequence([])
    expect(composition.durationInFrames).toBe(1)
    expect(composition.tracks[0]?.clips).toHaveLength(0)
    expect(composition.tracks[1]?.clips).toHaveLength(0)
  })
})

describe("attach labels and frame index", () => {
  it("formats scene and shot labels", () => {
    expect(sceneAttachLabel(2)).toBe("scene 2")
    expect(shotAttachLabel(1, 3)).toBe("scene 1 - shot 3")
  })

  it("maps frames onto the current shot", () => {
    expect(shotIndexFromFrame(0, 3)).toBe(0)
    expect(shotIndexFromFrame(SEQUENCE_FRAMES_PER_SHOT, 3)).toBe(1)
    expect(shotIndexFromFrame(SEQUENCE_FRAMES_PER_SHOT * 10, 3)).toBe(2)
    expect(shotIndexFromFrame(12, 0)).toBe(0)
  })
})
