import { describe, expect, it } from "vitest"
import {
  MAX_CONCURRENT_PREMOUNTS_PER_TRACK,
  PREMOUNT_LEAD_TIME_SECONDS,
  computeTrackClipPremounts,
} from "@sohizi/video-composition"
import type {
  AudioClip,
  TextClip,
  Track,
  VideoClip,
} from "@sohizi/video-composition"

function makeVideoClip(
  id: string,
  startFrame: number,
  endFrame: number,
): VideoClip {
  return {
    id,
    trackId: "track-video",
    type: "video",
    startFrame,
    endFrame,
    sourceStartFrame: 0,
    sourceDurationInFrames: endFrame - startFrame,
    url: `https://example.com/${id}.mp4`,
    fileName: id,
    volume: 0,
    opacity: 1,
    speed: 1,
    borderRadius: 0,
    xRatio: 0.5,
    yRatio: 0.5,
    widthRatio: 1,
    heightRatio: 1,
  }
}

function makeAudioClip(
  id: string,
  startFrame: number,
  endFrame: number,
): AudioClip {
  return {
    id,
    trackId: "track-audio",
    type: "audio",
    startFrame,
    endFrame,
    sourceStartFrame: 0,
    sourceDurationInFrames: endFrame - startFrame,
    url: `https://example.com/${id}.mp3`,
    fileName: id,
    volume: 0.8,
    speed: 1,
  }
}

function makeTextClip(
  id: string,
  startFrame: number,
  endFrame: number,
): TextClip {
  return {
    id,
    trackId: "track-text",
    type: "text",
    startFrame,
    endFrame,
    sourceStartFrame: 0,
    sourceDurationInFrames: endFrame - startFrame,
    text: id,
    fontSize: 48,
    color: "#ffffff",
    fontFamily: "Inter",
    fontWeight: "bold",
    align: "center",
    opacity: 1,
    xRatio: 0.5,
    yRatio: 0.5,
    widthRatio: 0.8,
    heightRatio: 0.2,
  }
}

describe("computeTrackClipPremounts", () => {
  it("gives each sequential video clip the full 1.5s premount window when clips are longer than the lead time", () => {
    const fps = 24
    const expectedLeadFrames = Math.ceil(fps * PREMOUNT_LEAD_TIME_SECONDS)
    const track: Track = {
      id: "track-video",
      type: "video",
      name: "Video 1",
      muted: false,
      hidden: false,
      clips: [
        makeVideoClip("sh_01", 0, 72),
        makeVideoClip("sh_02", 72, 120),
        makeVideoClip("sh_03", 120, 192),
        makeVideoClip("sh_04", 192, 264),
      ],
    }

    const premounts = computeTrackClipPremounts(track, fps)

    // Clip at frame 0 does not need premounting
    expect(premounts.has("sh_01")).toBe(false)
    expect(premounts.get("sh_02")).toBe(expectedLeadFrames)
    expect(premounts.get("sh_03")).toBe(expectedLeadFrames)
    expect(premounts.get("sh_04")).toBe(expectedLeadFrames)
  })

  it("caps concurrent premounts on rapid-cut timelines so decoder count stays bounded on large videos", () => {
    const fps = 30
    // 100 rapid 5-frame flash cuts (500 frames total)
    const clips: Array<VideoClip> = []
    for (let i = 0; i < 100; i += 1) {
      clips.push(makeVideoClip(`clip_${i}`, i * 5, (i + 1) * 5))
    }

    const track: Track = {
      id: "track-video",
      type: "video",
      name: "Video 1",
      muted: false,
      hidden: false,
      clips,
    }

    const premounts = computeTrackClipPremounts(track, fps)

    for (let frame = 0; frame < 500; frame += 1) {
      let premountingCountAtFrame = 0
      for (const clip of clips) {
        const premountFor = premounts.get(clip.id) ?? 0
        if (frame >= clip.startFrame - premountFor && frame < clip.startFrame) {
          premountingCountAtFrame += 1
        }
      }
      expect(premountingCountAtFrame).toBeLessThanOrEqual(
        MAX_CONCURRENT_PREMOUNTS_PER_TRACK,
      )
    }
  })

  it("skips premounting for muted audio tracks, hidden tracks, and non-media tracks", () => {
    const mutedAudioTrack: Track = {
      id: "track-audio",
      type: "audio",
      name: "Audio 1",
      muted: true,
      hidden: false,
      clips: [makeAudioClip("a1", 48, 120)],
    }
    const hiddenVideoTrack: Track = {
      id: "track-video",
      type: "video",
      name: "Video 1",
      muted: false,
      hidden: true,
      clips: [makeVideoClip("v1", 48, 120)],
    }
    const textTrack: Track = {
      id: "track-text",
      type: "text",
      name: "Text 1",
      muted: false,
      hidden: false,
      clips: [makeTextClip("t1", 48, 120)],
    }

    expect(computeTrackClipPremounts(mutedAudioTrack, 24).size).toBe(0)
    expect(computeTrackClipPremounts(hiddenVideoTrack, 24).size).toBe(0)
    expect(computeTrackClipPremounts(textTrack, 24).size).toBe(0)
  })
})
