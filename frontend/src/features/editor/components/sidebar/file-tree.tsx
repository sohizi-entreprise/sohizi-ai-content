import { useCallback } from 'react'
import {
  DeleteHandler,
  MoveHandler,
  RenameHandler,
  Tree,
  type NodeRendererProps,
} from 'react-arborist'
import { useMutation } from '@tanstack/react-query'
import type { FileTreeNode, NodeProps } from '../../types'
import { useFileTreeStore } from '../../stores/file-tree-store'
import {
  createFileNodeMutationOptions,
  renameFileNodeMutationOptions,
  moveFileNodeMutationOptions,
  deleteFileNodeMutationOptions,
} from '@/features/projects/query-mutation'
import { DirectoryNode, useLoadChildren } from '../file-node/node-directory'
import { DocumentNode } from '../file-node/node-file'
import useFileTreeBridge from '../../bridge/use-file-tree-bridge'

type FileTreeProps = {
  projectId: string
  rootFolderId: string
}

function Node(props: NodeProps) {

  const isDir = props.node.data.directory

  if (isDir) {
    return <DirectoryNode {...props} />
  }

  return <DocumentNode {...props} />
  
}


export function FileTree({ projectId, rootFolderId }: FileTreeProps) {
  const treeData = useFileTreeStore((s) => s.treeData)
  const removeNode = useFileTreeStore((s) => s.removeNode)
  const updateNode = useFileTreeStore((s) => s.updateNode)
  const insertNodeAt = useFileTreeStore((s) => s.insertNodeAt)
  const storeRootFolderId = useFileTreeStore((s) => s.rootFolderId)
  const setTree = useFileTreeBridge((s) => s.setTree)
  const runCommand = useFileTreeBridge((s) => s.runCommand)

  const createMutation = useMutation(createFileNodeMutationOptions(projectId))
  const renameMutation = useMutation(renameFileNodeMutationOptions(projectId))
  const moveMutation = useMutation(moveFileNodeMutationOptions(projectId))
  const deleteMutation = useMutation(deleteFileNodeMutationOptions(projectId))

  const handleLoadChildren = useLoadChildren()

  const createFileNode = useCallback((parentId: string, index: number, isDir: boolean = false) => {
    runCommand({ type: 'create', data: { projectId, parentId, index, isDir } })
  }, [projectId, runCommand])

  const onRename: RenameHandler<FileTreeNode> = async ({ id, name }) => {
    if (!name.trim()) {
      if (id.startsWith('temp-')) {
        removeNode(id)
      }
      return
    }

    if (id.startsWith('temp-')) {
      const node = findNodeInTree(treeData, id)
      if (!node) return
      const parentId = node.parentId ?? rootFolderId
      const siblings = findNodeInTree(treeData, parentId)?.children ?? treeData
      const position = (siblings.length + 1) * 1000

      const payload = {
        name: name.trim(),
        directory: node.directory,
        parentId,
        position,
        format: node.directory ? null : 'markdown',
        // editable: node.editable
      }

      createMutation.mutate(payload, {
        onSettled(created, error) {
          removeNode(id)
          if(error || !created) {
            console.error('Failed to create file node:', error)
            return
          }
          insertNodeAt(
            parentId,
            node.directory ? { ...created, children: [] } : created,
          )
        },
      })
      return
    }

    const node = findNodeInTree(treeData, id)
    if (!node || node.name === name.trim()) return

    updateNode(id, { name: name.trim() })
    try {
      await renameMutation.mutateAsync({ fileId: id, name: name.trim() })
    } catch (err) {
      console.error('Failed to rename:', err)
      updateNode(id, { name: node.name })
    }
  }

  const onMove: MoveHandler<FileTreeNode> = async ({ dragIds, parentId, index }) => {
    const fileId = dragIds[0]
    if (!fileId) return

    const resolvedParentId = parentId ?? rootFolderId

    const parentNode = parentId ? findNodeInTree(treeData, parentId) : null
    const siblings = parentNode ? (parentNode.children ?? []) : treeData
    const filteredSiblings = siblings.filter((s) => s.id !== fileId)

    let position: 'start' | 'end' | 'before' | 'after'
    let anchorId: string | null = null

    if (filteredSiblings.length === 0 || index === 0) {
      position = 'start'
    } else if (index >= filteredSiblings.length) {
      position = 'end'
    } else {
      anchorId = filteredSiblings[index - 1]?.id ?? null
      position = anchorId ? 'after' : 'start'
    }

    const node = findNodeInTree(treeData, fileId)
    if (!node) return

    removeNode(fileId)
    const clampedIndex = Math.min(index, filteredSiblings.length)
    insertNodeAt(
      resolvedParentId,
      { ...node, parentId: resolvedParentId },
      clampedIndex,
    )

    if (parentId && !useFileTreeStore.getState().isDirLoaded(parentId)) {
      await handleLoadChildren(parentId)
    }

    try {
      await moveMutation.mutateAsync({
        fileId,
        parentId: resolvedParentId,
        anchorId,
        position,
      })
    } catch (err) {
      console.error('Failed to move:', err)
    }
  }

  const onDelete: DeleteHandler<FileTreeNode> = async ({ ids }) => {
    for (const id of ids) {
      const node = findNodeInTree(treeData, id)
      if (!node) continue

      removeNode(id)
      if (!id.startsWith('temp-')) {
        try {
          await deleteMutation.mutateAsync(id)
        } catch (err) {
          console.error('Failed to delete:', err)
        }
      }
    }
  }

  const disableDrag = useCallback(
    (node: FileTreeNode) => node.id.startsWith('temp-'),
    [],
  )

  const nodeRenderer = useCallback(
    (props: NodeRendererProps<FileTreeNode>) => (
      <Node {...props} onCreateFile={createFileNode} />
    ),
    [createFileNode],
  )

  if (!storeRootFolderId) return null

  return (
    <Tree<FileTreeNode>
      ref={setTree}
      data={treeData}
      idAccessor="id"
      childrenAccessor="children"
      openByDefault={false}
      indent={16}
      rowHeight={28}
      width="100%"
      height={600}
      paddingBottom={20}
      disableDrag={disableDrag}
      disableDrop={(args) => {
        if (args.parentNode && !args.parentNode.data.directory) return true
        return false
      }}
      onRename={onRename}
      onMove={onMove}
      onDelete={onDelete}
    >
      {nodeRenderer}
    </Tree>
  )
}

function findNodeInTree(nodes: FileTreeNode[], id: string): FileTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    if (node.children) {
      const found = findNodeInTree(node.children, id)
      if (found) return found
    }
  }
  return null
}
