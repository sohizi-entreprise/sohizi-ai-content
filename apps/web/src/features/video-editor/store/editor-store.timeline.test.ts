import { beforeEach, describe, expect, it, vi } from "vitest"
import { toast } from "sonner"
import { useVideoEditorStore } from "./editor-store"

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

const FPS = 30
const MAX_FRAME = FPS * 20 * 60

describe("timeline duration cap", () => {
  beforeEach(() => {
    useVideoEditorStore.getState().resetStore()
    useVideoEditorStore.setState({ fps: FPS })
    vi.mocked(toast.error).mockClear()
  })

  it("trims a new clip that runs past 20 minutes", () => {
    const id = useVideoEditorStore.getState().addVideoClip({
      url: "v.mp4",
      fileName: "v.mp4",
      durationInFrames: FPS * 60 * 30,
      startFrame: 0,
    })

    expect(id).toEqual(expect.any(String))
    const clip = useVideoEditorStore.getState().tracks[0].clips[0]
    expect(clip.endFrame).toBe(MAX_FRAME)
    expect(useVideoEditorStore.getState().durationInFrames).toBe(MAX_FRAME)
    expect(toast.error).toHaveBeenCalled()
  })

  it("does not place a clip that starts at the cap", () => {
    const id = useVideoEditorStore.getState().addTextClip({
      text: "late",
      durationInFrames: FPS * 5,
      startFrame: MAX_FRAME,
    })

    expect(id).toBeNull()
    expect(useVideoEditorStore.getState().tracks).toEqual([])
  })

  it("stops a move at the 20 minute mark", () => {
    const id = useVideoEditorStore.getState().addTextClip({
      text: "hi",
      durationInFrames: FPS * 10,
      startFrame: 0,
    })
    expect(id).toEqual(expect.any(String))
    vi.mocked(toast.error).mockClear()

    useVideoEditorStore.getState().moveClip(id!, FPS * 60 * 30)
    const clip = useVideoEditorStore.getState().tracks[0].clips[0]
    expect(clip.startFrame).toBe(MAX_FRAME - FPS * 10)
    expect(clip.endFrame).toBe(MAX_FRAME)
  })

  it("stops a resize at the 20 minute mark", () => {
    const id = useVideoEditorStore.getState().addTextClip({
      text: "hi",
      durationInFrames: FPS * 10,
      startFrame: 0,
    })
    expect(id).toEqual(expect.any(String))

    useVideoEditorStore.getState().resizeClip(id!, "right", FPS * 60 * 25)
    const clip = useVideoEditorStore.getState().tracks[0].clips[0]
    expect(clip.endFrame).toBe(MAX_FRAME)
  })

  it("trims an opened composition that is already longer than 20 minutes", () => {
    useVideoEditorStore.getState().hydrate({
      compositionId: "c",
      fileNodeId: "f",
      projectId: "p",
      fps: FPS,
      durationInFrames: FPS * 60 * 30,
      aspectRatio: "16:9",
      width: 1920,
      height: 1080,
      tracks: [
        {
          id: "t",
          type: "video",
          name: "Video",
          muted: false,
          hidden: false,
          clips: [
            {
              id: "clip",
              trackId: "t",
              type: "video",
              startFrame: 0,
              endFrame: FPS * 60 * 30,
              sourceStartFrame: 0,
              sourceDurationInFrames: FPS * 60 * 30,
              url: "v.mp4",
              fileName: "v.mp4",
              volume: 1,
              opacity: 1,
              speed: 1,
              borderRadius: 0,
              xRatio: 0.5,
              yRatio: 0.5,
              widthRatio: 1,
              heightRatio: 1,
            },
          ],
        },
      ],
    })

    const state = useVideoEditorStore.getState()
    expect(state.durationInFrames).toBe(MAX_FRAME)
    expect(state.tracks[0].clips[0].endFrame).toBe(MAX_FRAME)
    expect(toast.error).not.toHaveBeenCalled()
  })
})

describe("applyServerChange", () => {
  beforeEach(() => {
    useVideoEditorStore.getState().resetStore()
    useVideoEditorStore.getState().hydrate({
      compositionId: "comp-1",
      fileNodeId: "file-1",
      projectId: "proj-1",
      fps: FPS,
      durationInFrames: 900,
      aspectRatio: "16:9",
      width: 1920,
      height: 1080,
      tracks: [],
    })
  })

  it("applies composition updates and increments serverSyncVersion", () => {
    const initialVersion = useVideoEditorStore.getState().serverSyncVersion

    useVideoEditorStore.getState().applyServerChange({
      type: "update_composition",
      composition: {
        id: "comp-1",
        projectId: "proj-1",
        fileNodeId: "file-1",
        fps: 60,
        durationInFrames: 1200,
        aspectRatio: "9:16",
        width: 1080,
        height: 1920,
        version: 2,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    })

    const state = useVideoEditorStore.getState()
    expect(state.fps).toBe(60)
    expect(state.durationInFrames).toBe(1200)
    expect(state.aspectRatio).toBe("9:16")
    expect(state.width).toBe(1080)
    expect(state.height).toBe(1920)
    expect(state.serverSyncVersion).toBe(initialVersion + 1)
  })

  it("ignores changes for a different composition", () => {
    const initialVersion = useVideoEditorStore.getState().serverSyncVersion

    useVideoEditorStore.getState().applyServerChange({
      type: "add_track",
      name: "Other Track",
      track: {
        id: "track-other",
        compositionId: "comp-other",
        type: "video",
        position: 0,
        muted: false,
        hidden: false,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    })

    const state = useVideoEditorStore.getState()
    expect(state.tracks).toHaveLength(0)
    expect(state.serverSyncVersion).toBe(initialVersion)
  })

  it("adds, updates, and removes tracks and clips from server payloads", () => {
    const store = useVideoEditorStore.getState()

    store.applyServerChange({
      type: "add_track",
      name: "Main Text",
      track: {
        id: "track-1",
        compositionId: "comp-1",
        type: "text",
        position: 0,
        muted: false,
        hidden: false,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    })

    expect(useVideoEditorStore.getState().tracks).toEqual([
      {
        id: "track-1",
        type: "text",
        name: "Main Text",
        muted: false,
        hidden: false,
        clips: [],
      },
    ])

    store.applyServerChange({
      type: "add_clip",
      clip: {
        id: "clip-1",
        trackId: "track-1",
        compositionId: "comp-1",
        type: "text",
        startFrame: 0,
        endFrame: 150,
        sourceStartFrame: 0,
        sourceDurationInFrames: 150,
        properties: {
          text: "Hello world",
          fontSize: 72,
          color: "#ff0000",
          fontFamily: "Inter",
          fontWeight: "bold",
          align: "center",
          opacity: 1,
          xRatio: 0.5,
          yRatio: 0.5,
          widthRatio: 0.8,
          heightRatio: 0.2,
        },
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    })

    expect(useVideoEditorStore.getState().tracks[0].clips).toHaveLength(1)
    expect(useVideoEditorStore.getState().tracks[0].clips[0]).toMatchObject({
      id: "clip-1",
      type: "text",
      text: "Hello world",
      fontSize: 72,
      startFrame: 0,
      endFrame: 150,
    })

    store.applyServerChange({
      type: "update_clip",
      clip: {
        id: "clip-1",
        trackId: "track-1",
        compositionId: "comp-1",
        type: "text",
        startFrame: 30,
        endFrame: 180,
        sourceStartFrame: 0,
        sourceDurationInFrames: 150,
        properties: {
          text: "Updated text",
          fontSize: 72,
          color: "#ff0000",
          fontFamily: "Inter",
          fontWeight: "bold",
          align: "center",
          opacity: 1,
          xRatio: 0.5,
          yRatio: 0.5,
          widthRatio: 0.8,
          heightRatio: 0.2,
        },
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    })

    expect(useVideoEditorStore.getState().tracks[0].clips[0]).toMatchObject({
      id: "clip-1",
      text: "Updated text",
      startFrame: 30,
      endFrame: 180,
    })

    store.applyServerChange({
      type: "remove_clip",
      clipId: "clip-1",
    })

    // Track remains intact even when its last clip is removed by server change
    expect(useVideoEditorStore.getState().tracks).toHaveLength(1)
    expect(useVideoEditorStore.getState().tracks[0].clips).toHaveLength(0)

    store.applyServerChange({
      type: "update_track",
      name: "Renamed Text",
      track: {
        id: "track-1",
        compositionId: "comp-1",
        type: "text",
        position: 0,
        muted: true,
        hidden: true,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    })

    expect(useVideoEditorStore.getState().tracks[0]).toMatchObject({
      id: "track-1",
      name: "Renamed Text",
      muted: true,
      hidden: true,
    })

    store.applyServerChange({
      type: "remove_track",
      trackId: "track-1",
    })

    expect(useVideoEditorStore.getState().tracks).toHaveLength(0)
  })
})

describe("same-track non-overlap constraints", () => {
  beforeEach(() => {
    useVideoEditorStore.getState().resetStore()
    useVideoEditorStore.setState({ fps: FPS })
    vi.mocked(toast.error).mockClear()
  })

  it("prevents resizing a clip right past the next sibling clip on the same track", () => {
    const store = useVideoEditorStore.getState()
    const firstId = store.addTextClip({
      text: "First",
      startFrame: 0,
      durationInFrames: 90,
    })
    const trackId = useVideoEditorStore.getState().tracks[0].id
    const secondId = store.addTextClip({
      trackId,
      text: "Second",
      startFrame: 120,
      durationInFrames: 90,
    })

    expect(firstId).toBeTruthy()
    expect(secondId).toBeTruthy()

    useVideoEditorStore.getState().resizeClip(firstId!, "right", 180)
    const clips = useVideoEditorStore.getState().tracks[0].clips
    const first = clips.find((c) => c.id === firstId)!
    const second = clips.find((c) => c.id === secondId)!

    expect(first.endFrame).toBe(120)
    expect(second.startFrame).toBe(120)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("prevents resizing a clip left into the previous sibling clip on the same track", () => {
    const store = useVideoEditorStore.getState()
    const firstId = store.addVideoClip({
      url: "a.mp4",
      fileName: "a.mp4",
      startFrame: 0,
      durationInFrames: 100,
    })
    const trackId = useVideoEditorStore.getState().tracks[0].id
    const secondId = store.addVideoClip({
      trackId,
      url: "b.mp4",
      fileName: "b.mp4",
      startFrame: 150,
      durationInFrames: 100,
    })

    expect(firstId).toBeTruthy()
    expect(secondId).toBeTruthy()

    useVideoEditorStore.getState().resizeClip(secondId!, "left", 50)
    const clips = useVideoEditorStore.getState().tracks[0].clips
    const second = clips.find((c) => c.id === secondId)!

    expect(second.startFrame).toBe(100)
    expect(second.endFrame).toBe(250)
  })

  it("clamps horizontal move on the same track so sibling clips never overlap", () => {
    const store = useVideoEditorStore.getState()
    const firstId = store.addTextClip({
      text: "First",
      startFrame: 0,
      durationInFrames: 100,
    })
    const trackId = useVideoEditorStore.getState().tracks[0].id
    const secondId = store.addTextClip({
      trackId,
      text: "Second",
      startFrame: 150,
      durationInFrames: 100,
    })

    // Nudging first clip right by +70 frames (to 70..170) should stop flush at 50..150
    useVideoEditorStore.getState().moveClip(firstId!, 70)
    let clips = useVideoEditorStore.getState().tracks[0].clips
    let first = clips.find((c) => c.id === firstId)!
    expect(first.startFrame).toBe(50)
    expect(first.endFrame).toBe(150)

    // Dragging first clip far past the second clip (delta +220 -> requested 270) lands cleanly after second clip at >= 250
    useVideoEditorStore.getState().moveClip(firstId!, 220)
    clips = useVideoEditorStore.getState().tracks[0].clips
    first = clips.find((c) => c.id === firstId)!
    const second = clips.find((c) => c.id === secondId)!
    expect(first.startFrame).toBeGreaterThanOrEqual(second.endFrame)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("places newly added or cross-track moved clips into non-overlapping slots", () => {
    const store = useVideoEditorStore.getState()
    const firstId = store.addTextClip({
      text: "Existing",
      startFrame: 0,
      durationInFrames: 100,
    })
    const trackId = useVideoEditorStore.getState().tracks[0].id

    // Adding a clip at startFrame 40 on the same track should not overlap [0, 100)
    const overlappingAddId = store.addTextClip({
      trackId,
      text: "Added on top",
      startFrame: 40,
      durationInFrames: 60,
    })
    expect(overlappingAddId).toBeTruthy()

    const clips = useVideoEditorStore.getState().tracks[0].clips
    const first = clips.find((c) => c.id === firstId)!
    const added = clips.find((c) => c.id === overlappingAddId)!
    expect(added.startFrame).toBeGreaterThanOrEqual(first.endFrame)
  })
})
