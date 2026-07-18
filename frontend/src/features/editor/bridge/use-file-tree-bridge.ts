import { z } from 'zod'
import { create } from 'zustand'
import { insertNodeAt as insertNodeInCache } from '../stores/file-tree-cache'
import type { FileNodeFormat, FileTreeNode } from '../types'
import type { TreeApi } from 'react-arborist'
import type { QueryClient } from '@tanstack/react-query'

type TreeType = TreeApi<FileTreeNode>

const createCommand = z.object({
  type: z.literal('create'),
  data: z.object({
    projectId: z.string(),
    parentId: z.string(),
    index: z.number(),
    isDir: z.boolean(),
    format: z.string().optional(),
  }),
})
const deleteCommand = z.object({
  type: z.literal('delete'),
  data: z.object({ projectId: z.string(), ids: z.array(z.string()) }),
})

const commandSchema = z.discriminatedUnion('type', [
  createCommand,
  deleteCommand,
])

type Command = z.infer<typeof commandSchema>

type FileTreeBridgeState = {
  tree: TreeType | null
  setTree: (tree: TreeType | null | undefined) => void
  runCommand: (command: Command, queryClient: QueryClient) => void
}

const useFileTreeBridgeStore = create<FileTreeBridgeState>((set, get) => ({
  tree: null,

  setTree: (tree) => set({ tree: tree ?? null }),

  runCommand: (command, queryClient) => {
    const tree = get().tree

    if (!tree) {
      console.error('Tree ref is not set')
      return
    }

    switch (command.type) {
      case 'create': {
        const { projectId, parentId, index, isDir, format } = command.data
        const tempNode = createTempNode(
          projectId,
          parentId,
          index,
          isDir,
          format,
        )
        insertNodeInCache(queryClient, projectId, parentId, tempNode, index)
        setTimeout(() => {
          get().tree?.edit(tempNode.id)
        }, 50)
        break
      }
    }
  },
}))

export default useFileTreeBridgeStore

function createTempNode(
  projectId: string,
  parentId: string,
  index: number,
  isDir: boolean = false,
  format: FileNodeFormat = 'markdown',
) {
  const tempId = `temp-${Date.now()}`
  const tempNode: FileTreeNode = {
    id: tempId,
    name: '',
    directory: isDir,
    projectId,
    format: isDir ? null : format,
    parentId,
    position: index * 1000,
    editable: true,
    contentEditable: true,
  }
  return tempNode
}
