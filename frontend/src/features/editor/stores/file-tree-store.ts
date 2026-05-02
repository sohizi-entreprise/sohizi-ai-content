import { create } from 'zustand'
import type { FileTreeNode } from '../types'
import { ProjectResponse } from '@/features/projects/type'

type Project = Omit<ProjectResponse, 'format' | 'genre'>

interface FileTreeState {
  projectId: string | null
  project: Project | null
  rootFolderId: string | null
  treeData: FileTreeNode[]
  loadedDirIds: Set<string>

  init: (projectId: string, rootFolderId: string, rootFiles: FileTreeNode[], project: Project) => void
  setTreeData: (data: FileTreeNode[]) => void
  appendChildren: (parentId: string, children: FileTreeNode[]) => void
  updateNode: (id: string, patch: Partial<FileTreeNode>) => void
  removeNode: (id: string) => void
  insertNodeAt: (parentId: string, node: FileTreeNode, index?: number) => void
  markDirLoaded: (dirId: string) => void
  isDirLoaded: (dirId: string) => boolean
}

function updateTreeRecursive(
  nodes: FileTreeNode[],
  id: string,
  updater: (node: FileTreeNode) => FileTreeNode | null,
): FileTreeNode[] {
  return nodes.reduce<FileTreeNode[]>((acc, node) => {
    if (node.id === id) {
      const result = updater(node)
      if (result) acc.push(result)
      return acc
    }
    const updatedNode = node.children
      ? { ...node, children: updateTreeRecursive(node.children, id, updater) }
      : node
    acc.push(updatedNode)
    return acc
  }, [])
}

function appendChildrenToNode(
  nodes: FileTreeNode[],
  parentId: string,
  children: FileTreeNode[],
): FileTreeNode[] {
  return nodes.map((node) => {
    if (node.id === parentId) {
      return { ...node, children }
    }
    if (node.children) {
      return { ...node, children: appendChildrenToNode(node.children, parentId, children) }
    }
    return node
  })
}

function insertNodeInTree(
  nodes: FileTreeNode[],
  parentId: string,
  newNode: FileTreeNode,
  index?: number,
): FileTreeNode[] {
  return nodes.map((node) => {
    if (node.id === parentId) {
      const existing = node.children ?? []
      const insertIdx = index !== undefined ? index : existing.length
      const updated = [...existing]
      updated.splice(insertIdx, 0, newNode)
      return { ...node, children: updated }
    }
    if (node.children) {
      return { ...node, children: insertNodeInTree(node.children, parentId, newNode, index) }
    }
    return node
  })
}

function insertNodeAtRoot(
  nodes: FileTreeNode[],
  newNode: FileTreeNode,
  index?: number,
): FileTreeNode[] {
  const insertIdx = index !== undefined ? index : nodes.length
  const updated = [...nodes]
  updated.splice(insertIdx, 0, newNode)
  return updated
}

export const useFileTreeStore = create<FileTreeState>((set, get) => ({
  projectId: null,
  project: null,
  rootFolderId: null,
  treeData: [],
  loadedDirIds: new Set(),

  init: (projectId, rootFolderId, rootFiles, project) => {
    const files = rootFiles ?? []
    const dirNodes = files.map((f) =>
      f.directory ? { ...f, children: f.children ?? [] } : f,
    )
    set({
      projectId,
      rootFolderId,
      treeData: dirNodes,
      loadedDirIds: new Set([rootFolderId]),
      project
    })
  },

  setTreeData: (data) => set({ treeData: data }),

  appendChildren: (parentId, children) => {
    const dirChildren = children.map((f) =>
      f.directory ? { ...f, children: f.children ?? [] } : f,
    )
    set((s) => ({
      treeData: appendChildrenToNode(s.treeData, parentId, dirChildren),
    }))
  },

  updateNode: (id, patch) => {
    set((s) => ({
      treeData: updateTreeRecursive(s.treeData, id, (node) => ({ ...node, ...patch })),
    }))
  },

  removeNode: (id) => {
    set((s) => ({
      treeData: updateTreeRecursive(s.treeData, id, () => null),
    }))
  },

  insertNodeAt: (parentId, node, index) => {
    set((s) => ({
      treeData:
        s.rootFolderId === parentId
          ? insertNodeAtRoot(s.treeData, node, index)
          : insertNodeInTree(s.treeData, parentId, node, index),
    }))
  },

  markDirLoaded: (dirId) => {
    set((s) => {
      const next = new Set(s.loadedDirIds)
      next.add(dirId)
      return { loadedDirIds: next }
    })
  },

  isDirLoaded: (dirId) => get().loadedDirIds.has(dirId),
}))
