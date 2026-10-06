import { describe, expect, it } from "vitest"
import { createGridDragItem, moveGridItem } from "./file-grid-dnd"
import type { DirectoryChild } from "@/features/projects/type"

function child(type: DirectoryChild["type"], previewUrl: string | null) {
  return {
    id: "node",
    name: "asset",
    directory: false,
    projectId: "project",
    type,
    format: null,
    parentId: "folder",
    position: 1000,
    editable: true,
    contentEditable: true,
    path: "/asset",
    previewUrl,
  } satisfies DirectoryChild
}

describe("createGridDragItem", () => {
  it("includes media metadata so the timeline can ingest a grid asset", () => {
    const node = child("video", "https://cdn/video.mp4")
    expect(createGridDragItem(node, ["node", "other"])).toEqual({
      id: "node",
      dragIds: ["node"],
      fromGrid: true,
      gridNode: node,
      order: ["node", "other"],
      fromLibrary: true,
      label: "asset",
      format: "video",
      url: "https://cdn/video.mp4",
    })
  })

  it("keeps non-media items sortable without marking them as timeline assets", () => {
    const node = child("document", null)
    expect(createGridDragItem(node)).toEqual({
      id: "node",
      dragIds: ["node"],
      fromGrid: true,
      gridNode: node,
      order: [],
    })
  })
})

describe("moveGridItem", () => {
  it("moves to the hovered cell in either direction", () => {
    expect(moveGridItem(["a", "b", "c", "d"], "a", "c")).toEqual([
      "b",
      "c",
      "a",
      "d",
    ])
    expect(moveGridItem(["a", "b", "c", "d"], "d", "b")).toEqual([
      "a",
      "d",
      "b",
      "c",
    ])
  })
})
