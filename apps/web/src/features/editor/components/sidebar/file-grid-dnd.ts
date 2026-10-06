import type { DirectoryChild } from "@/features/projects/type"
import type { LibraryAssetDragItem } from "@/features/video-editor/utils/library-dnd"
import type { ArboristNodeDragItem } from "../../utils/arborist-dnd"

export type GridNodeDragItem = ArboristNodeDragItem &
  Partial<LibraryAssetDragItem> & {
    fromGrid: true
    gridNode: DirectoryChild
    order: Array<string>
    lastTargetId?: string
  }

export type GridDropItem = ArboristNodeDragItem &
  Partial<LibraryAssetDragItem> & {
    fromGrid?: true
    order?: Array<string>
    lastTargetId?: string
  }

export function createGridDragItem(
  node: DirectoryChild,
  order: Array<string> = [],
): GridNodeDragItem {
  const base = {
    id: node.id,
    dragIds: [node.id],
    fromGrid: true as const,
    gridNode: node,
    order: [...order],
  }
  if (node.type !== "image" && node.type !== "video" && node.type !== "audio") {
    return base
  }
  return {
    ...base,
    fromLibrary: true,
    label: node.name,
    format: node.type,
    url: node.previewUrl,
  }
}

export function moveGridItem(
  order: Array<string>,
  id: string,
  targetId: string,
) {
  const sourceIndex = order.indexOf(id)
  const targetIndex = order.indexOf(targetId)
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return order
  }

  const next = [...order]
  const [source] = next.splice(sourceIndex, 1)
  next.splice(targetIndex, 0, source)
  return next
}
