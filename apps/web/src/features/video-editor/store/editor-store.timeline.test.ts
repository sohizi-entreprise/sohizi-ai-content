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
