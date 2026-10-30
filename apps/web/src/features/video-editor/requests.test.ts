import { beforeEach, describe, expect, it, vi } from "vitest"
import { MAX_BATCH_OPERATIONS, batchEdit } from "./requests"
import { diffStateToBatchOps } from "./transforms"
import { useVideoEditorStore } from "./store/editor-store"
import type { BatchOperation } from "./requests"

const postMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/axios", () => ({
  default: {
    post: postMock,
    get: vi.fn(),
    delete: vi.fn(),
  },
}))

describe("diffStateToBatchOps on FPS change", () => {
  it("emits only update_composition and no update_clip operations when clips are only rescaled by setFps", () => {
    useVideoEditorStore.getState().resetStore()
    useVideoEditorStore.getState().hydrate({
      compositionId: "comp-1",
      fileNodeId: "file-1",
      projectId: "proj-1",
      fps: 30,
      durationInFrames: 3660,
      aspectRatio: "16:9",
      width: 1920,
      height: 1080,
      tracks: [
        {
          id: "track-1",
          type: "image",
          name: "Image 1",
          muted: false,
          hidden: false,
          clips: Array.from({ length: 65 }, (_, i) => ({
            id: `clip-${i}`,
            trackId: "track-1",
            type: "image" as const,
            startFrame: i * 50,
            endFrame: (i + 1) * 50,
            sourceStartFrame: 0,
            sourceDurationInFrames: 50,
            url: `https://example.com/${i}.png`,
            fileName: `${i}.png`,
            opacity: 1,
            borderRadius: 0,
            blur: 0,
            brightness: 100,
            fit: "contain" as const,
            fadeInFrames: 0,
            fadeOutFrames: 0,
            animationIn: "none" as const,
            animationOut: "none" as const,
            motionEffect: "none" as const,
            xRatio: 0.5,
            yRatio: 0.5,
            widthRatio: 1,
            heightRatio: 1,
          })),
        },
      ],
    })

    const prevState = useVideoEditorStore.getState()
    const prevSnapshot = {
      compositionId: prevState.compositionId!,
      fps: prevState.fps,
      durationInFrames: prevState.durationInFrames,
      aspectRatio: prevState.aspectRatio,
      width: prevState.width,
      height: prevState.height,
      tracks: structuredClone(prevState.tracks),
    }

    useVideoEditorStore.getState().setFps(60)

    const nextState = useVideoEditorStore.getState()
    const nextSnapshot = {
      compositionId: nextState.compositionId!,
      fps: nextState.fps,
      durationInFrames: nextState.durationInFrames,
      aspectRatio: nextState.aspectRatio,
      width: nextState.width,
      height: nextState.height,
      tracks: structuredClone(nextState.tracks),
    }

    const ops = diffStateToBatchOps(prevSnapshot, nextSnapshot)

    expect(ops).toEqual([
      {
        op: "update_composition",
        compositionId: "comp-1",
        patch: {
          fps: 60,
          durationInFrames: 7320,
        },
      },
    ])
  })
})

describe("batchEdit", () => {
  beforeEach(() => {
    postMock.mockReset()
  })

  it("sends a single request when operations count is within MAX_BATCH_OPERATIONS", async () => {
    postMock.mockResolvedValueOnce({
      data: [{ op: "update_composition", id: "comp-1" }],
    })

    const ops: Array<BatchOperation> = [
      {
        op: "update_composition",
        compositionId: "comp-1",
        patch: { fps: 60, durationInFrames: 7320 },
      },
    ]

    const result = await batchEdit("proj-1", "comp-1", ops)

    expect(postMock).toHaveBeenCalledTimes(1)
    expect(postMock).toHaveBeenCalledWith(
      "/video-editor/proj-1/compositions/comp-1/batch",
      { operations: ops },
    )
    expect(result).toEqual([{ op: "update_composition", id: "comp-1" }])
  })

  it("splits operations into chunks when exceeding MAX_BATCH_OPERATIONS", async () => {
    postMock
      .mockResolvedValueOnce({ data: [{ op: "update_clip", id: "chunk-1" }] })
      .mockResolvedValueOnce({ data: [{ op: "update_clip", id: "chunk-2" }] })

    const total = MAX_BATCH_OPERATIONS + 15
    const ops: Array<BatchOperation> = Array.from(
      { length: total },
      (_, i) => ({
        op: "update_clip" as const,
        clipId: `clip-${i}`,
        patch: { endFrame: (i + 1) * 60 },
      }),
    )

    const result = await batchEdit("proj-1", "comp-1", ops)

    expect(postMock).toHaveBeenCalledTimes(2)
    expect(postMock.mock.calls[0][1].operations).toHaveLength(
      MAX_BATCH_OPERATIONS,
    )
    expect(postMock.mock.calls[1][1].operations).toHaveLength(15)
    expect(result).toEqual([
      { op: "update_clip", id: "chunk-1" },
      { op: "update_clip", id: "chunk-2" },
    ])
  })
})
