// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useVideoEditorStore } from "../store/editor-store"
import { useVideoEditorUiStore } from "../store/ui-store"
import { useVideoExport } from "./use-video-export"
import type { PropsWithChildren } from "react"
import type { RenderJob } from "../requests"
import type { Track } from "../store/types"

const requests = vi.hoisted(() => ({
  createRender: vi.fn(),
  getRender: vi.fn(),
  cancelRender: vi.fn(),
  getRenderDownload: vi.fn(),
}))

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}))

vi.mock("../requests", () => ({
  ...requests,
  loadComposition: vi.fn(),
  batchEdit: vi.fn(),
  generateCaption: vi.fn(),
}))

vi.mock("sonner", () => ({ toast }))

const PROJECT_ID = "project-1"
const COMPOSITION_ID = "composition-1"

const videoTrack: Track = {
  id: "track-1",
  type: "video",
  name: "Video",
  muted: false,
  hidden: false,
  clips: [
    {
      id: "clip-1",
      trackId: "track-1",
      type: "video",
      startFrame: 0,
      endFrame: 300,
      sourceStartFrame: 0,
      sourceDurationInFrames: 300,
      url: "https://cdn.sohizi.test/videos/a.mp4",
      fileName: "a.mp4",
      volume: 1,
      opacity: 1,
      speed: 1,
      borderRadius: 0,
      xRatio: 0,
      yRatio: 0,
      widthRatio: 1,
      heightRatio: 1,
    },
  ],
}

function job(overrides: Partial<RenderJob> = {}): RenderJob {
  return {
    id: "render-1",
    status: "queued",
    progress: 0,
    fileName: "my-video.mp4",
    fps: 30,
    width: 1920,
    height: 1080,
    durationInFrames: 300,
    sizeInBytes: null,
    error: null,
    createdAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    ...overrides,
  }
}

let queryClient: QueryClient

function wrapper({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function seedActiveRender(seeded: RenderJob) {
  useVideoEditorUiStore.setState({
    activeRender: { compositionId: COMPOSITION_ID, jobId: seeded.id },
  })
  queryClient.setQueryData(
    ["video-editor", "render", PROJECT_ID, seeded.id],
    seeded,
  )
  requests.getRender.mockResolvedValue(seeded)
}

// Vitest runs without globals here, so React Testing Library cannot register
// its own cleanup hook.
afterEach(() => {
  cleanup()
  queryClient.clear()
})

beforeEach(() => {
  vi.clearAllMocks()
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  useVideoEditorUiStore.setState({ activeRender: null })
  useVideoEditorStore.setState({
    projectId: PROJECT_ID,
    compositionId: COMPOSITION_ID,
    fps: 30,
    width: 1920,
    height: 1080,
    durationInFrames: 300,
    tracks: [videoTrack],
  })
})

describe("useVideoExport", () => {
  it("submits the live editor snapshot", async () => {
    requests.createRender.mockResolvedValue(job())
    requests.getRender.mockResolvedValue(job())

    const { result } = renderHook(() => useVideoExport(), { wrapper })
    await act(() => result.current.start("My Video.mp4"))

    expect(requests.createRender).toHaveBeenCalledWith(
      PROJECT_ID,
      COMPOSITION_ID,
      {
        contractVersion: 1,
        fileName: "My Video.mp4",
        composition: {
          fps: 30,
          width: 1920,
          height: 1080,
          durationInFrames: 300,
          tracks: [videoTrack],
        },
      },
    )
    await waitFor(() => expect(result.current.job?.id).toBe("render-1"))
    expect(result.current.isBusy).toBe(true)
  })

  it("refuses to export an empty timeline", async () => {
    useVideoEditorStore.setState({ tracks: [{ ...videoTrack, clips: [] }] })

    const { result } = renderHook(() => useVideoExport(), { wrapper })
    await act(() => result.current.start("My Video"))

    expect(requests.createRender).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith(
      "Add something to the timeline before exporting.",
    )
  })

  it("ignores a second submission while a render is in flight", async () => {
    seedActiveRender(job({ status: "rendering", progress: 40 }))

    const { result } = renderHook(() => useVideoExport(), { wrapper })
    await waitFor(() => expect(result.current.job?.status).toBe("rendering"))
    await act(() => result.current.start("My Video"))

    expect(requests.createRender).not.toHaveBeenCalled()
  })

  it("surfaces a failed render", async () => {
    seedActiveRender(
      job({
        status: "failed",
        error: { code: "render_failed", message: "Render crashed" },
      }),
    )

    const { result } = renderHook(() => useVideoExport(), { wrapper })

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Render crashed"),
    )
    expect(result.current.isBusy).toBe(false)
  })

  it("downloads the finished video through a signed url", async () => {
    seedActiveRender(
      job({ status: "completed", progress: 100, sizeInBytes: 2048 }),
    )
    requests.getRenderDownload.mockResolvedValue({
      url: "https://signed.sohizi.test/renders/render-1.mp4",
      fileName: "my-video.mp4",
      sizeInBytes: 2048,
    })
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {})

    const { result } = renderHook(() => useVideoExport(), { wrapper })
    await waitFor(() => expect(result.current.job?.status).toBe("completed"))
    await act(() => result.current.download())

    expect(requests.getRenderDownload).toHaveBeenCalledWith(
      PROJECT_ID,
      "render-1",
    )
    expect(click).toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("cancels a running render", async () => {
    seedActiveRender(job({ status: "rendering", progress: 10 }))
    requests.cancelRender.mockResolvedValue(job({ status: "cancelled" }))

    const { result } = renderHook(() => useVideoExport(), { wrapper })
    await waitFor(() => expect(result.current.job?.status).toBe("rendering"))
    await act(() => result.current.cancel())

    expect(requests.cancelRender).toHaveBeenCalledWith(PROJECT_ID, "render-1")
    await waitFor(() => expect(result.current.job?.status).toBe("cancelled"))
  })
})
