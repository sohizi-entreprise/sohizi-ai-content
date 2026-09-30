import { describe, expect, it, vi } from "vitest"
import { fetchImageAssetUrl, isImageFileNode } from "./shot-image-drop"
import type { FileTreeNode } from "../../types"

const requests = vi.hoisted(() => ({
  getFileContent: vi.fn(),
}))

vi.mock("../../requests", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../requests")>()
  return {
    ...actual,
    getFileContent: requests.getFileContent,
  }
})

function node(patch: Partial<FileTreeNode>): FileTreeNode {
  return {
    id: "file-1",
    name: "hero.png",
    directory: false,
    projectId: "proj-1",
    type: "image",
    format: "file",
    parentId: null,
    position: 0,
    editable: true,
    contentEditable: false,
    path: "/hero.png",
    ...patch,
  }
}

describe("isImageFileNode", () => {
  it("accepts image files", () => {
    expect(isImageFileNode(node({ type: "image" }))).toBe(true)
  })

  it("rejects directories, even when typed as image", () => {
    expect(isImageFileNode(node({ directory: true, type: "image" }))).toBe(
      false,
    )
  })

  it("rejects non-image files", () => {
    expect(isImageFileNode(node({ type: "video", name: "clip.mp4" }))).toBe(
      false,
    )
    expect(isImageFileNode(node({ type: "document", name: "notes.md" }))).toBe(
      false,
    )
  })

  it("rejects missing nodes", () => {
    expect(isImageFileNode(null)).toBe(false)
    expect(isImageFileNode(undefined)).toBe(false)
  })
})

describe("fetchImageAssetUrl", () => {
  it("returns the url for image assets", async () => {
    requests.getFileContent.mockResolvedValueOnce({
      type: "image",
      url: "https://cdn.example.com/hero.png",
      name: "hero.png",
    })

    await expect(fetchImageAssetUrl("proj-1", "file-1")).resolves.toBe(
      "https://cdn.example.com/hero.png",
    )
  })

  it("returns null when the file is not an image asset", async () => {
    requests.getFileContent.mockResolvedValueOnce({
      type: "video",
      url: "https://cdn.example.com/clip.mp4",
      name: "clip.mp4",
    })

    await expect(fetchImageAssetUrl("proj-1", "file-1")).resolves.toBeNull()
  })
})
