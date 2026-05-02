import { TreeApi } from "react-arborist"
import { FileTreeNode } from "../types"
import { z } from "zod"
import { useFileTreeStore } from "../stores/file-tree-store"
import { create } from "zustand"


type TreeType = TreeApi<FileTreeNode>

const createCommand = z.object({type: z.literal('create'), data: z.object({projectId: z.string(), parentId: z.string(), index: z.number(), isDir: z.boolean()})})
const deleteCommand = z.object({type: z.literal('delete'), data: z.object({projectId: z.string(), ids: z.array(z.string())})})

const commandSchema = z.discriminatedUnion('type', [createCommand, deleteCommand,])

type Command = z.infer<typeof commandSchema>

type FileTreeBridgeState = {
  tree: TreeType | null
  setTree: (tree: TreeType | null | undefined) => void
  runCommand: (command: Command) => void
}

const useFileTreeBridgeStore = create<FileTreeBridgeState>((set, get) => ({
  tree: null,

  setTree: (tree) => set({ tree: tree ?? null }),

  runCommand: (command) => {
    const tree = get().tree

    if (!tree) {
      console.error('Tree ref is not set')
      return
    }

    switch (command.type) {
      case 'create': {
        const { projectId, parentId, index, isDir } = command.data
        const tempNode = createTempNode(projectId, parentId, index, isDir)
        useFileTreeStore.getState().insertNodeAt(parentId, tempNode, index)
        setTimeout(() => {
          get().tree?.edit(tempNode.id)
        }, 50)
        break
      }
    }
  },
}))

export default useFileTreeBridgeStore

function createTempNode(projectId: string, parentId: string, index: number, isDir: boolean = false) {
    const tempId = `temp-${Date.now()}`
    const tempNode: FileTreeNode = {
      id: tempId,
      name: '',
      directory: isDir,
      projectId,
      format: isDir ? null : 'markdown',
      parentId,
      position: index * 1000,
      editable: true,
    }
    return tempNode
}
