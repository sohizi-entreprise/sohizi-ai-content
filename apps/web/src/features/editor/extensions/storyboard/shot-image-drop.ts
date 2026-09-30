import { findNodeById } from "../../stores/file-tree-cache"
import { useFileTreeStore } from "../../stores/file-tree-store"
import { getFileContent } from "../../requests"
import type { QueryClient } from "@tanstack/react-query"
import type { FileTreeNode } from "../../types"
import type { ArboristNodeDragItem } from "../../utils/arborist-dnd"

export function isImageFileNode(
  node: FileTreeNode | null | undefined,
): node is FileTreeNode & { type: "image" } {
  return Boolean(node && !node.directory && node.type === "image")
}

export function findDraggedImageNode(
  queryClient: QueryClient,
  item: ArboristNodeDragItem,
): (FileTreeNode & { type: "image" }) | null {
  const { projectId, rootFolderId } = useFileTreeStore.getState()
  if (!projectId) return null
  const node = findNodeById(queryClient, projectId, rootFolderId, item.id)
  return isImageFileNode(node) ? node : null
}

export async function fetchImageAssetUrl(
  projectId: string,
  fileId: string,
): Promise<string | null> {
  const content = await getFileContent(projectId, fileId)
  if (content.type !== "image" || !content.url) return null
  return content.url
}
