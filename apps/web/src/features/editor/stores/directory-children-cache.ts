import {
  getDirChildren,
  insertNodeAt,
  isDirLoaded,
  removeNode,
  reorderNodesInDirectory,
  updateNode,
} from "./file-tree-cache"
import type { InfiniteData, QueryClient } from "@tanstack/react-query"
import type {
  DirectoryChild,
  DirectoryChildrenPage,
} from "@/features/projects/type"
import { directoryChildrenKey } from "@/features/projects/query-mutation"

type DirectoryChildrenData = InfiniteData<
  DirectoryChildrenPage,
  string | undefined
>

function patchPages(
  qc: QueryClient,
  projectId: string,
  parentId: string,
  mapData: (nodes: Array<DirectoryChild>) => Array<DirectoryChild>,
) {
  qc.setQueryData<DirectoryChildrenData>(
    directoryChildrenKey(projectId, parentId),
    (current) => {
      if (!current) return current
      return {
        ...current,
        pages: current.pages.map((page) => ({
          ...page,
          data: mapData(page.data),
        })),
      }
    },
  )
}

export function updateDirectoryChild(
  qc: QueryClient,
  projectId: string,
  parentId: string,
  id: string,
  patch: Partial<DirectoryChild>,
) {
  patchPages(qc, projectId, parentId, (nodes) =>
    nodes.map((node) => (node.id === id ? { ...node, ...patch } : node)),
  )
  updateNode(qc, projectId, parentId, id, patch)
}

export function removeDirectoryChild(
  qc: QueryClient,
  projectId: string,
  parentId: string,
  id: string,
) {
  patchPages(qc, projectId, parentId, (nodes) =>
    nodes.filter((node) => node.id !== id),
  )
  removeNode(qc, projectId, parentId, id)
  qc.removeQueries({ queryKey: directoryChildrenKey(projectId, id) })
}

export function appendDirectoryChild(
  qc: QueryClient,
  projectId: string,
  parentId: string,
  node: DirectoryChild,
) {
  const gridData = qc.getQueryData<DirectoryChildrenData>(
    directoryChildrenKey(projectId, parentId),
  )
  const lastPage = gridData?.pages[gridData.pages.length - 1]
  if (lastPage && !lastPage.hasMore) {
    qc.setQueryData<DirectoryChildrenData>(
      directoryChildrenKey(projectId, parentId),
      (current) => {
        if (!current || current.pages.length === 0) return current
        const items = current.pages
          .flatMap((page) => page.data)
          .filter((item) => item.id !== node.id)
        items.push(node)
        items.sort(compareDirectoryChildren)

        let offset = 0
        const pages = current.pages.map((page, index) => {
          const isLast = index === current.pages.length - 1
          const length = isLast ? items.length - offset : page.data.length
          const data = items.slice(offset, offset + length)
          offset += length
          return { ...page, data }
        })
        return { ...current, pages }
      },
    )
  }

  if (!isDirLoaded(qc, projectId, parentId)) return
  const existing = getDirChildren(qc, projectId, parentId) ?? []
  if (existing.some((item) => item.id === node.id)) return
  const index = existing.findIndex(
    (item) => compareDirectoryChildren(node, item) < 0,
  )
  insertNodeAt(
    qc,
    projectId,
    parentId,
    node,
    index === -1 ? existing.length : index,
  )
}

export function reorderDirectoryChild(
  qc: QueryClient,
  projectId: string,
  parentId: string,
  id: string,
  targetId: string,
  placement: "before" | "after",
) {
  qc.setQueryData<DirectoryChildrenData>(
    directoryChildrenKey(projectId, parentId),
    (current) => {
      if (!current) return current
      const pageLengths = current.pages.map((page) => page.data.length)
      const reordered = reorderNodes(
        current.pages.flatMap((page) => page.data),
        id,
        targetId,
        placement,
      )
      let offset = 0
      return {
        ...current,
        pages: current.pages.map((page, index) => {
          const length = pageLengths[index] ?? 0
          const data = reordered.slice(offset, offset + length)
          offset += length
          return { ...page, data }
        }),
      }
    },
  )

  const children = getDirChildren(qc, projectId, parentId)
  if (!children) return
  const reordered = reorderNodes(children, id, targetId, placement)
  if (reordered === children) return
  reorderNodesInDirectory(qc, projectId, parentId, reordered)
}

export function reorderDirectoryChildren(
  qc: QueryClient,
  projectId: string,
  parentId: string,
  orderedIds: Array<string>,
) {
  qc.setQueryData<DirectoryChildrenData>(
    directoryChildrenKey(projectId, parentId),
    (current) => {
      if (!current) return current
      const pageLengths = current.pages.map((page) => page.data.length)
      const reordered = reorderNodesByIds(
        current.pages.flatMap((page) => page.data),
        orderedIds,
      )
      let offset = 0
      return {
        ...current,
        pages: current.pages.map((page, index) => {
          const length = pageLengths[index] ?? 0
          const data = reordered.slice(offset, offset + length)
          offset += length
          return { ...page, data }
        }),
      }
    },
  )

  const children = getDirChildren(qc, projectId, parentId)
  if (!children) return
  reorderNodesInDirectory(
    qc,
    projectId,
    parentId,
    reorderNodesByIds(children, orderedIds),
  )
}

function reorderNodes<T extends { id: string }>(
  nodes: Array<T>,
  id: string,
  targetId: string,
  placement: "before" | "after",
) {
  const sourceIndex = nodes.findIndex((node) => node.id === id)
  const originalTargetIndex = nodes.findIndex((node) => node.id === targetId)
  if (sourceIndex < 0 || originalTargetIndex < 0 || id === targetId)
    return nodes

  const reordered = [...nodes]
  const source = reordered.splice(sourceIndex, 1)[0]
  const targetIndex = reordered.findIndex((node) => node.id === targetId)
  reordered.splice(
    placement === "before" ? targetIndex : targetIndex + 1,
    0,
    source,
  )
  return reordered
}

function reorderNodesByIds<T extends { id: string }>(
  nodes: Array<T>,
  orderedIds: Array<string>,
) {
  const nodesById = new Map(nodes.map((node) => [node.id, node]))
  const ordered = orderedIds.flatMap((id) => {
    const node = nodesById.get(id)
    if (!node) return []
    nodesById.delete(id)
    return [node]
  })
  return [...ordered, ...nodes.filter((node) => nodesById.has(node.id))]
}

function compareDirectoryChildren(
  a: { id: string; position: number },
  b: { id: string; position: number },
) {
  return a.position - b.position || a.id.localeCompare(b.id)
}
