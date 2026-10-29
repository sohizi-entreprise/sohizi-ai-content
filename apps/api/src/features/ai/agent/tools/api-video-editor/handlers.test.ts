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
  sourceStartFrame: 0,
  sourceDurationInFrames: 90,
  properties: {
    url: "https://example.com/v.mp4",
    fileName: "v.mp4",
    volume: 1,
    opacity: 1,
    speed: 1,
    borderRadius: 0,
  },
  createdAt: now,
  updatedAt: now,
}

mock.module("@/features/video-editor/repo", () => ({
  getCompositionByFileNodeId: async () => mockComposition,
  updateComposition: async () => mockComposition,
  getNextTrackPosition: async () => 0,
  createTrack: async () => mockTrack,
  updateTrack: async () => ({ ...mockTrack, muted: true }),
  deleteTrack: async () => true,
  getTrackById: async () => mockTrack,
  createClip: async () => mockClip,
  updateClip: async () => ({ ...mockClip, endFrame: 120 }),
  deleteClip: async () => true,
}))

const {
  executeUpdateComposition,
  executeAddTrack,
  executeUpdateTrack,
  executeRemoveTrack,
  executeAddClip,
  executeUpdateClip,
  executeRemoveClip,
} = await import("./handlers")

const mockOptions = {
  session: {
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
          sourceStartFrame: 0,
          sourceDurationInFrames: 90,
          properties: mockClip.properties,
        },
      },
      mockOptions,
    )
    expect(addRes.videoEditorChanges).toEqual([
      { type: "add_clip", clip: mockClip },
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
})
