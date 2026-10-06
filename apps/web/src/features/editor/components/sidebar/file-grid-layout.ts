import type { DirectoryChild } from "@/features/projects/type"

export const GRID_TILE_WIDTH = 96
export const GRID_TILE_GAP = 8
export const GRID_MIN_COLUMNS = 2
export const GRID_PREVIEW_SIZE = 72
export const GRID_ROW_HEIGHT = 116

export type GridDraft = {
  node: DirectoryChild
  insertIndex: number
  move?: {
    anchorId?: string
    position: "start" | "before" | "after"
  }
}

export function gridColumnCount(width: number) {
  if (width <= 0) return GRID_MIN_COLUMNS
  const fitted = Math.floor(
    (width + GRID_TILE_GAP) / (GRID_TILE_WIDTH + GRID_TILE_GAP),
  )
  return Math.max(GRID_MIN_COLUMNS, fitted)
}

export function gridRowWidth(columns: number) {
  return columns * GRID_TILE_WIDTH + Math.max(0, columns - 1) * GRID_TILE_GAP
}

export function buildGridItems(
  serverItems: Array<DirectoryChild>,
  draft: GridDraft | null,
  pinned: Array<DirectoryChild>,
) {
  const serverIds = new Set(serverItems.map((item) => item.id))
  const base = [...serverItems]
  for (const item of pinned) {
    if (serverIds.has(item.id)) continue
    const index = base.findIndex(
      (existing) => compareDirectoryChildren(item, existing) < 0,
    )
    base.splice(index === -1 ? base.length : index, 0, item)
  }
  if (draft) {
    const existingIndex = base.findIndex((item) => item.id === draft.node.id)
    if (existingIndex >= 0) base.splice(existingIndex, 1)
  }
  if (draft && !serverIds.has(draft.node.id)) {
    const index = Math.min(Math.max(draft.insertIndex, 0), base.length)
    base.splice(index, 0, draft.node)
  }
  return base
}

function compareDirectoryChildren(a: DirectoryChild, b: DirectoryChild) {
  return a.position - b.position || a.id.localeCompare(b.id)
}
