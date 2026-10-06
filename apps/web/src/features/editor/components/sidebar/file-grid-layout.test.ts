import { describe, expect, it } from "vitest"
import {
  GRID_MIN_COLUMNS,
  GRID_TILE_GAP,
  GRID_TILE_WIDTH,
  buildGridItems,
  gridColumnCount,
} from "./file-grid-layout"
import type { DirectoryChild } from "@/features/projects/type"

function child(id: string, position = 1000): DirectoryChild {
  return {
    id,
    name: id,
    directory: false,
    projectId: "project",
    type: "document",
    format: "markdown",
    parentId: "folder",
    position,
    editable: true,
    contentEditable: true,
    path: `/${id}`,
    previewUrl: null,
  }
}

describe("gridColumnCount", () => {
  it("keeps at least two columns when the panel is narrow", () => {
    expect(gridColumnCount(0)).toBe(GRID_MIN_COLUMNS)
    expect(gridColumnCount(GRID_TILE_WIDTH)).toBe(GRID_MIN_COLUMNS)
    const twoColumnWidth = GRID_TILE_WIDTH * 2 + GRID_TILE_GAP
    expect(gridColumnCount(twoColumnWidth)).toBe(GRID_MIN_COLUMNS)
  })

  it("adds columns as the panel grows without stretching tiles", () => {
    const fourColumnWidth = 4 * GRID_TILE_WIDTH + 3 * GRID_TILE_GAP
    expect(gridColumnCount(fourColumnWidth)).toBe(4)
    expect(gridColumnCount(fourColumnWidth - 1)).toBe(3)
  })
})

describe("buildGridItems", () => {
  it("inserts a draft at the requested index and appends pinned files", () => {
    const server = [child("a", 1000), child("b", 2000)]
    const draft = child("temp-1", 0)
    const pinned = child("new", 3000)

    expect(
      buildGridItems(server, { node: draft, insertIndex: 1 }, [pinned]).map(
        (item) => item.id,
      ),
    ).toEqual(["a", "temp-1", "b", "new"])
  })

  it("drops a pinned file once the server page includes it", () => {
    const server = [child("a"), child("new", 3000)]
    expect(
      buildGridItems(server, null, [child("new", 3000)]).map((item) => item.id),
    ).toEqual(["a", "new"])
  })

  it("merges pinned files in position order", () => {
    const server = [child("b", 2000), child("c", 3000)]
    expect(
      buildGridItems(server, null, [child("a", 1000)]).map((item) => item.id),
    ).toEqual(["a", "b", "c"])
  })
})
