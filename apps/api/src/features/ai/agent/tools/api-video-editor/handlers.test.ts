import { describe, expect, it, mock } from "bun:test"
import type { ToolExecutionOptions } from "../tool-definition"

const now = new Date("2026-01-01T00:00:00Z")

const mockComposition = {
  id: "comp-1",
  projectId: "proj-1",
  fileNodeId: "file-1",
  fps: 60,
  durationInFrames: 1200,
  aspectRatio: "9:16" as const,
  width: 1080,
  height: 1920,
  version: 2,
  createdAt: now,
  updatedAt: now,
}

const mockTrack = {
  id: "track-1",
  compositionId: "comp-1",
  type: "video" as const,
  position: 0,
  muted: false,
  hidden: false,
  createdAt: now,
  updatedAt: now,
}

const mockClip = {
  id: "clip-1",
  trackId: "track-1",
  compositionId: "comp-1",
  type: "video" as const,
  startFrame: 0,
  endFrame: 90,
  sourceStartFrame: 10,
  sourceDurationInFrames: 200,
  properties: {
    url: "https://example.com/v.mp4",
    fileName: "v.mp4",
    volume: 1,
    opacity: 1,
    speed: 1.5,
    borderRadius: 0,
    fadeInFrames: 12,
    fadeOutFrames: 15,
  },
  createdAt: now,
  updatedAt: now,
}

const mockSecondClip = {
  id: "clip-2",
  trackId: "track-1",
  compositionId: "comp-1",
  type: "video" as const,
  startFrame: 120,
  endFrame: 180,
  sourceStartFrame: 0,
  sourceDurationInFrames: 100,
  properties: {
    url: "https://example.com/v2.mp4",
    fileName: "v2.mp4",
    volume: 1,
    opacity: 1,
    speed: 1,
    borderRadius: 0,
  },
  createdAt: now,
  updatedAt: now,
}

let fullCompCalls = 0
const mockCaptionTrack = {
  id: "track-cap",
  compositionId: "comp-1",
  type: "caption" as const,
  position: 0,
  muted: false,
  hidden: false,
  createdAt: now,
  updatedAt: now,
}
const mockCaptionClip = {
  id: "clip-cap-1",
  trackId: "track-cap",
  compositionId: "comp-1",
  type: "caption" as const,
  startFrame: 0,
  endFrame: 90,
  sourceStartFrame: 10,
  sourceDurationInFrames: 200,
  properties: {
    text: "Hello there",
    words: [{ word: "Hello", start: 0, end: 0.5 }],
    fontSize: 48,
  },
  createdAt: now,
  updatedAt: now,
}

mock.module("@/features/video-editor/repo", () => ({
  getCompositionByFileNodeId: async () => mockComposition,
  updateComposition: async () => mockComposition,
  getNextTrackPosition: async () => 0,
  createTrack: async () => mockTrack,
  updateTrack: async (_id: string, data: Record<string, unknown>) => ({
    ...mockTrack,
    ...data,
  }),
  deleteTrack: async () => true,
  getTrackById: async () => mockTrack,
  getClipById: async (id: string) => (id === "clip-1" ? mockClip : null),
  getClipsByFilters: async () => [mockClip, mockSecondClip],
  createClip: async (data: Record<string, unknown>) => ({
    ...mockClip,
    id: "clip-created",
    ...data,
  }),
  updateClip: async (id: string, data: Record<string, unknown>) => ({
    ...(id === "clip-2" ? mockSecondClip : mockClip),
    ...data,
  }),
  deleteClip: async () => true,
  getFullComposition: async () => {
    fullCompCalls += 1
    if (fullCompCalls % 2 === 1) {
      return {
        composition: mockComposition,
        tracks: [mockTrack],
        clips: [mockClip],
      }
    }
    return {
      composition: mockComposition,
      tracks: [mockCaptionTrack, { ...mockTrack, position: 1 }],
      clips: [mockCaptionClip, mockClip],
    }
  },
}))

mock.module("@/features/video-editor/service", () => ({
  addCaption: async () => ({ ok: true }),
}))

const {
  executeUpdateComposition,
  executeAddTrack,
  executeUpdateTrack,
  executeRemoveTrack,
  executeAddClip,
  executeUpdateClip,
  executeRemoveClip,
  executeSplitClip,
  executeRippleShift,
  executeGenerateCaptions,
  executeBatch,
  executeViewClipSchema,
} = await import("./handlers")

const mockOptions = {
  session: {
    projectId: "proj-1",
    userId: "user-1",
    resolveFileByPathOrId: async () => ({ id: "file-1" }),
  },
} as unknown as ToolExecutionOptions

describe("api-video-editor handlers videoEditorChanges", () => {
  it("emits update_composition change payload", async () => {
    const res = await executeUpdateComposition(
      {
        endpoint: "/video-editor/composition",
        method: "PATCH",
        body: { filePath: "/video.ve", fps: 60 },
      },
      mockOptions,
    )

    expect(res.success).toBe(true)
    expect(res.videoEditorChanges).toEqual([
      { type: "update_composition", composition: mockComposition },
    ])
  })

  it("emits add_track, update_track, and remove_track change payloads", async () => {
    const addRes = await executeAddTrack(
      {
        endpoint: "/video-editor/tracks/add",
        method: "POST",
        body: { filePath: "/video.ve", type: "video", name: "Main Video" },
      },
      mockOptions,
    )
    expect(addRes.videoEditorChanges).toEqual([
      { type: "add_track", track: mockTrack, name: "Main Video" },
    ])

    const updateRes = await executeUpdateTrack(
      {
        endpoint: "/video-editor/tracks/update",
        method: "PATCH",
        body: { trackId: "track-1", muted: true, name: "Muted Video" },
      },
      mockOptions,
    )
    expect(updateRes.videoEditorChanges).toEqual([
      {
        type: "update_track",
        track: { ...mockTrack, muted: true },
        name: "Muted Video",
      },
    ])

    const removeRes = await executeRemoveTrack(
      {
        endpoint: "/video-editor/tracks/remove",
        method: "DELETE",
        params: { trackId: "track-1" },
      },
      mockOptions,
    )
    expect(removeRes.videoEditorChanges).toEqual([
      { type: "remove_track", trackId: "track-1" },
    ])
  })

  it("emits add_clip, update_clip, and remove_clip change payloads", async () => {
    const addRes = await executeAddClip(
      {
        endpoint: "/video-editor/clips/add",
        method: "POST",
        body: {
          trackId: "track-1",
          type: "video",
          startFrame: 0,
          endFrame: 90,
          sourceStartFrame: 10,
          sourceDurationInFrames: 200,
          properties: mockClip.properties,
        },
      },
      mockOptions,
    )
    expect(addRes.videoEditorChanges).toEqual([
      { type: "add_clip", clip: { ...mockClip, id: "clip-created" } },
    ])

    const updateRes = await executeUpdateClip(
      {
        endpoint: "/video-editor/clips/update",
        method: "PATCH",
        body: { clipId: "clip-1", endFrame: 120 },
      },
      mockOptions,
    )
    expect(updateRes.videoEditorChanges).toEqual([
      { type: "update_clip", clip: { ...mockClip, endFrame: 120 } },
    ])

    const removeRes = await executeRemoveClip(
      {
        endpoint: "/video-editor/clips/remove",
        method: "DELETE",
        params: { clipId: "clip-1" },
      },
      mockOptions,
    )
    expect(removeRes.videoEditorChanges).toEqual([
      { type: "remove_clip", clipId: "clip-1" },
    ])
  })

  it("splits a clip and computes sourceStartFrame continuity with speed", async () => {
    const splitRes = await executeSplitClip(
      {
        endpoint: "/video-editor/clips/split",
        method: "POST",
        body: { clipId: "clip-1", frame: 40 },
      },
      mockOptions,
    )

    expect(splitRes.success).toBe(true)
    // 40 frames * 1.5 speed = 60 frames + 10 initial sourceStartFrame = 70
    expect(splitRes.videoEditorChanges).toHaveLength(2)
    expect(splitRes.videoEditorChanges?.[0]).toMatchObject({
      type: "update_clip",
      clip: {
        id: "clip-1",
        startFrame: 0,
        endFrame: 40,
      },
    })
    expect(splitRes.videoEditorChanges?.[1]).toMatchObject({
      type: "add_clip",
      clip: {
        id: "clip-created",
        startFrame: 40,
        endFrame: 90,
        sourceStartFrame: 70,
      },
    })
  })

  it("ripple-shifts downstream clips and rejects shifts that overlap stationary clips", async () => {
    const validShift = await executeRippleShift(
      {
        endpoint: "/video-editor/clips/ripple-shift",
        method: "POST",
        body: {
          filePath: "/video.ve",
          fromFrame: 100,
          deltaFrames: 30,
        },
      },
      mockOptions,
    )
    expect(validShift.success).toBe(true)
    expect(validShift.videoEditorChanges).toEqual([
      {
        type: "update_clip",
        clip: {
          ...mockSecondClip,
          startFrame: 150,
          endFrame: 210,
        },
      },
    ])

    // Shifting clip-2 (starts at 120) left by -40 frames moves it to 80, overlapping clip-1 (ends at 90)
    const overlappingShift = await executeRippleShift(
      {
        endpoint: "/video-editor/clips/ripple-shift",
        method: "POST",
        body: {
          filePath: "/video.ve",
          fromFrame: 100,
          deltaFrames: -40,
        },
      },
      mockOptions,
    )
    expect(overlappingShift.success).toBe(false)
    expect(overlappingShift.output).toContain("overlap")
  })

  it("executes batch operations and emits all videoEditorChanges", async () => {
    const batchRes = await executeBatch(
      {
        endpoint: "/video-editor/batch",
        method: "POST",
        body: {
          filePath: "/video.ve",
          operations: [
            { op: "update_composition", patch: { durationInFrames: 1500 } },
            { op: "update_clip", clipId: "clip-1", patch: { endFrame: 100 } },
            { op: "remove_clip", clipId: "clip-2" },
          ],
        },
      },
      mockOptions,
    )

    expect(batchRes.success).toBe(true)
    expect(batchRes.videoEditorChanges).toHaveLength(3)
    expect(batchRes.videoEditorChanges?.[0]?.type).toBe("update_composition")
    expect(batchRes.videoEditorChanges?.[1]?.type).toBe("update_clip")
    expect(batchRes.videoEditorChanges?.[2]).toEqual({
      type: "remove_clip",
      clipId: "clip-2",
    })
  })

  it("generates captions and emits track and clip changes", async () => {
    const capRes = await executeGenerateCaptions(
      {
        endpoint: "/video-editor/captions/generate",
        method: "POST",
        body: { trackId: "track-1" },
      },
      mockOptions,
    )

    expect(capRes.success).toBe(true)
    expect(capRes.videoEditorChanges).toEqual([
      { type: "add_track", track: mockCaptionTrack, name: "Captions" },
      { type: "add_clip", clip: mockCaptionClip },
      { type: "update_track", track: { ...mockTrack, position: 1 } },
    ])
  })

  it("returns JSON schema for caption and enhanced clip types", async () => {
    const captionSchemaRes = await executeViewClipSchema(
      {
        endpoint: "/video-editor/clips/schema",
        method: "GET",
        params: { clipType: "caption" },
      },
      mockOptions,
    )
    expect(captionSchemaRes.success).toBe(true)
    expect(captionSchemaRes.output).toContain("hightlightColor")

    const imageSchemaRes = await executeViewClipSchema(
      {
        endpoint: "/video-editor/clips/schema",
        method: "GET",
        params: { clipType: "image" },
      },
      mockOptions,
    )
    expect(imageSchemaRes.success).toBe(true)
    expect(imageSchemaRes.output).toContain("motionEffect")
    expect(imageSchemaRes.output).toContain("fadeInFrames")
  })
})
