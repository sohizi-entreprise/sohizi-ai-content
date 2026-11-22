// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useEditorStore } from "../../stores/editor-store"
import AssetViewer from "./asset-viewer"
import { useChatStore } from "@/features/chat/store/chat-store"
import * as mediaRequests from "@/features/media-generator/requests"

vi.mock("@/utils/transform-url", () => ({
  buildOptimizeddImageUrl: (url: string) => url,
  imageUrlTransforms: {
    previews: {
      contentCard: {},
    },
  },
}))

vi.mock("@/features/media-generator/requests", async (importOriginal) => {
  const actual = await importOriginal<typeof mediaRequests>()
  return {
    ...actual,
    getAiGeneratedRequest: vi.fn(),
    getAssetDownloadUrl: vi.fn(),
  }
})

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  )
}

describe("AssetViewer", () => {
  beforeEach(() => {
    useChatStore.getState().reset()
    useEditorStore.setState({
      chatOpenByContext: {
        "file-system": false,
        "media-generator": true,
      },
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it("hides source badge and Source button while showing Attach button for user-uploaded assets", () => {
    renderWithQueryClient(
      <AssetViewer
        id="file-1"
        assetId="asset-1"
        name="photo.png"
        path="/root/assets/photo.png"
        type="image"
        url="https://cdn.example.com/photo.png"
        storageKey="photo.png"
        metadata={{ size: 1024, contentType: "image/png" }}
        source="user-uploaded"
        projectId="proj-1"
      />,
    )

    expect(screen.queryByText(/user uploaded/i)).toBeNull()
    expect(screen.queryByText(/ai generated/i)).toBeNull()
    expect(screen.getByRole("button", { name: /attach/i })).toBeTruthy()
    expect(screen.queryByRole("button", { name: /source/i })).toBeNull()
  })

  it("attaches asset url and type to chat store when clicking Attach", () => {
    renderWithQueryClient(
      <AssetViewer
        id="file-1"
        assetId="asset-1"
        name="photo.png"
        path="/root/assets/photo.png"
        type="image"
        url="https://cdn.example.com/photo.png"
        storageKey="photo.png"
        metadata={{ size: 1024, contentType: "image/png" }}
        source="user-uploaded"
        projectId="proj-1"
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: /attach/i }))

    const attachedFiles = useChatStore.getState().attachedFiles
    expect(attachedFiles).toHaveLength(1)
    expect(attachedFiles[0]).toMatchObject({
      id: "asset-1",
      status: "uploaded",
      url: "https://cdn.example.com/photo.png",
      type: "image/png",
    })
    expect(useEditorStore.getState().chatOpenByContext["file-system"]).toBe(
      true,
    )
  })

  it("renders 'ai generated' badge and opens Source dialog fetching generation request when clicking Source", async () => {
    vi.mocked(mediaRequests.getAiGeneratedRequest).mockResolvedValue({
      id: "req-123",
      projectId: "proj-1",
      status: "completed",
      request: {
        model: "flux-pro",
        settings: {
          prompt: "A futuristic neon skyline at dusk",
          aspect_ratio: "16:9",
        },
        context: {
          generationType: "image",
          mediaType: "image",
        },
      },
      error: null,
      credits: 5,
      createdAt: "2026-11-08T00:00:00.000Z",
      updatedAt: "2026-11-08T00:00:00.000Z",
      assets: [],
    })

    renderWithQueryClient(
      <AssetViewer
        id="file-2"
        assetId="asset-2"
        name="skyline.png"
        path="/root/assets/skyline.png"
        type="image"
        url="https://cdn.example.com/skyline.png"
        storageKey="skyline.png"
        metadata={{ size: 2048, contentType: "image/png" }}
        source="ai-generated"
        generationRequestId="req-123"
        projectId="proj-1"
      />,
    )

    expect(screen.getByText(/ai generated/i)).toBeTruthy()
    const sourceBtn = screen.getByRole("button", { name: /source/i })
    expect(sourceBtn).toBeTruthy()

    fireEvent.click(sourceBtn)

    expect(
      await screen.findByText("A futuristic neon skyline at dusk"),
    ).toBeTruthy()
    expect(mediaRequests.getAiGeneratedRequest).toHaveBeenCalledWith(
      "proj-1",
      "req-123",
    )
    expect(screen.getByText("flux-pro")).toBeTruthy()
  })

  it("downloads the asset when clicking the download icon button", async () => {
    vi.mocked(mediaRequests.getAssetDownloadUrl).mockResolvedValue({
      url: "https://signed.example.com/photo.png",
    })
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {})

    renderWithQueryClient(
      <AssetViewer
        id="file-1"
        assetId="asset-1"
        name="photo.png"
        path="/root/assets/photo.png"
        type="image"
        url="https://cdn.example.com/photo.png"
        storageKey="photo.png"
        metadata={{ size: 1024, contentType: "image/png" }}
        source="user-uploaded"
        projectId="proj-1"
      />,
    )

    const downloadBtn = screen.getByRole("button", { name: /download asset/i })
    fireEvent.click(downloadBtn)

    await vi.waitFor(() => {
      expect(mediaRequests.getAssetDownloadUrl).toHaveBeenCalledWith(
        "proj-1",
        "asset-1",
      )
      expect(clickSpy).toHaveBeenCalled()
    })
  })
})
