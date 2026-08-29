import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { QueryClient, QueryKey } from '@tanstack/react-query'
import type { FileTreeNode } from '../types'
import { fileTreeKey } from '@/features/projects/query-mutation'

/**
 * The editor file tree is stored in the TanStack Query cache as one entry per
 * directory, keyed by `['project', projectId, 'file-tree', dirId]`. Each entry
 * holds that directory's DIRECT children as a flat list. The nested tree that
 * react-arborist consumes is assembled on demand from these entries.
 */

function getEntry(
  qc: QueryClient,
  projectId: string,
  dirId: string,
): Array<FileTreeNode> | undefined {
  return qc.getQueryData<Array<FileTreeNode>>(fileTreeKey(projectId, dirId))
}

function setEntry(
  qc: QueryClient,
  projectId: string,
  dirId: string,
  children: Array<FileTreeNode>,
): void {
  qc.setQueryData(fileTreeKey(projectId, dirId), children)
}

export function getDirChildren(
  qc: QueryClient,
  projectId: string,
  dirId: string,
): Array<FileTreeNode> | undefined {
  return getEntry(qc, projectId, dirId)
}

export function isDirLoaded(
  qc: QueryClient,
  projectId: string,
  dirId: string,
): boolean {
  return getEntry(qc, projectId, dirId) !== undefined
}

export function insertNodeAt(
  qc: QueryClient,
  projectId: string,
  parentId: string,
  node: FileTreeNode,
  index?: number,
): void {
  const existing = getEntry(qc, projectId, parentId) ?? []
  const insertIdx = index !== undefined ? index : existing.length
  const updated = [...existing]
  updated.splice(insertIdx, 0, node)
  setEntry(qc, projectId, parentId, updated)
}

export function updateNode(
  qc: QueryClient,
  projectId: string,
  parentId: string,
  id: string,
  patch: Partial<FileTreeNode>,
): void {
  const existing = getEntry(qc, projectId, parentId)
  if (!existing) return
  setEntry(
    qc,
    projectId,
    parentId,
    existing.map((n) => (n.id === id ? { ...n, ...patch } : n)),
  )
}

export function removeNode(
  qc: QueryClient,
  projectId: string,
  parentId: string,
  id: string,
): void {
  const existing = getEntry(qc, projectId, parentId)
  if (existing) {
    setEntry(
      qc,
      projectId,
      parentId,
      existing.filter((n) => n.id !== id),
    )
  }
  // Drop the removed directory's own children entry, if any.
  qc.removeQueries({ queryKey: fileTreeKey(projectId, id) })
}

export function assembleTree(
  qc: QueryClient,
  projectId: string,
  rootFolderId: string | null,
): Array<FileTreeNode> {
  if (!rootFolderId) return []
  return buildChildren(qc, projectId, rootFolderId)
}

function buildChildren(
  qc: QueryClient,
  projectId: string,
  dirId: string,
): Array<FileTreeNode> {
  const entry = getEntry(qc, projectId, dirId)
  if (!entry) return []
  return entry.map((node) =>
    node.directory
      ? { ...node, children: buildChildren(qc, projectId, node.id) }
      : node,
  )
}

export function findNodeById(
  qc: QueryClient,
  projectId: string,
  rootFolderId: string | null,
  id: string,
): FileTreeNode | null {
  if (!rootFolderId) return null
  return findInDir(qc, projectId, rootFolderId, id)
}

function findInDir(
  qc: QueryClient,
  projectId: string,
  dirId: string,
  id: string,
): FileTreeNode | null {
  const entry = getEntry(qc, projectId, dirId)
  if (!entry) return null
  for (const node of entry) {
    if (node.id === id) return node
    if (node.directory) {
      const found = findInDir(qc, projectId, node.id, id)
      if (found) return found
    }
  }
  return null
}

function isFileTreeKey(key: QueryKey, projectId: string): boolean {
  return (
    Array.isArray(key) &&
    key[0] === 'project' &&
    key[1] === projectId &&
    key[2] === 'file-tree'
  )
}

/**
 * Assembles the nested file tree from the per-directory cache entries and
 * re-renders whenever any file-tree entry for this project changes.
 */
export function useProjectFileTree(
  projectId: string,
  rootFolderId: string | null,
): Array<FileTreeNode> {
  const qc = useQueryClient()
  const versionRef = useRef(0)

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const cache = qc.getQueryCache()
      return cache.subscribe((event) => {
        // Only react to actual data updates for this project's file tree.
        // Ignoring observer add/remove/result events avoids re-render loops
        // and setState-during-render warnings.
        if (event.type !== 'updated') return
        const key = event.query.queryKey
        if (key && isFileTreeKey(key, projectId)) {
          versionRef.current += 1
          onStoreChange()
        }
      })
    },
    [qc, projectId],
  )

  const getSnapshot = useCallback(() => versionRef.current, [])
  const version = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  return useMemo(
    () => assembleTree(qc, projectId, rootFolderId),
    [qc, projectId, rootFolderId, version],
  )
}
