import { useCallback, useLayoutEffect, useRef, useState } from "react"
import { Tree } from "react-arborist"
import { useDragDropManager } from "react-dnd"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useFileTreeStore } from "../../stores/file-tree-store"
import { useEditorStore } from "../../stores/editor-store"
import {
  appendDirectoryChild,
  removeDirectoryChild,
  updateDirectoryChild,
} from "../../stores/directory-children-cache"
import {
  insertNodeAt as insertNodeInCache,
  isDirLoaded,
  removeNode as removeNodeFromCache,
  updateNode as updateNodeInCache,
  useProjectFileTree,
} from "../../stores/file-tree-cache"
import { DirectoryNode } from "../file-node/node-directory"
import { DocumentNode } from "../file-node/node-file"
import useFileTreeBridge from "../../bridge/use-file-tree-bridge"
import { defaultFormatForType } from "../../utils/file-kind"
import type {
  DeleteHandler,
  MoveHandler,
  NodeRendererProps,
  RenameHandler,
  RowRendererProps,
} from "react-arborist"
import type { FileNodeType, FileTreeNode, NodeProps } from "../../types"
import { cn } from "@/lib/utils"
import {
  createFileNodeMutationOptions,
  deleteFileNodeMutationOptions,
  directoryChildrenKey,
  fileTreeKey,
  getlistFileTreePerDirectoryOptions,
  moveFileNodeMutationOptions,
  renameFileNodeMutationOptions,
} from "@/features/projects/query-mutation"

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

export function FileTreeRow({
  node,
  innerRef,
  attrs,
  children,
}: RowRendererProps<FileTreeNode>) {
  const { style, className, ...rest } = attrs

  return (
    <div
      {...rest}
      ref={innerRef}
      onFocus={(event) => event.stopPropagation()}
      onClick={(event) => {
        if (event.button === 0) node.handleClick(event)
      }}
      className={cn("min-w-0 overflow-hidden", className)}
      style={{ ...style, minWidth: 0, width: "100%" }}
    >
      {children}
    </div>
  )
}

export function FileTree({ projectId, rootFolderId }: FileTreeProps) {
  const dndManager = useDragDropManager()
  const queryClient = useQueryClient()
  const containerRef = useRef<HTMLDivElement>(null)
  const [treeHeight, setTreeHeight] = useState(0)
  const storeRootFolderId = useFileTreeStore((s) => s.rootFolderId)

  // The project snapshot can predate grid edits. Load the root from its own
  // directory query so entering list view cannot seed it with old rootFiles.
  useQuery(getlistFileTreePerDirectoryOptions(projectId, rootFolderId))

  const treeData = useProjectFileTree(projectId, rootFolderId)
  const setTree = useFileTreeBridge((s) => s.setTree)
  const runCommand = useFileTreeBridge((s) => s.runCommand)

  const createMutation = useMutation(createFileNodeMutationOptions(projectId))
  const renameMutation = useMutation(renameFileNodeMutationOptions(projectId))
  const moveMutation = useMutation(moveFileNodeMutationOptions(projectId))
  const deleteMutation = useMutation(deleteFileNodeMutationOptions(projectId))
  const openFile = useEditorStore((s) => s.openFile)
  const closeTab = useEditorStore((s) => s.closeTab)
  const updateTab = useEditorStore((s) => s.updateTab)

  const createFileNode = useCallback(
    (
      parentId: string,
      index: number,
      isDir: boolean = false,
      type?: FileNodeType,
    ) => {
      runCommand(
        {
          type: "create",
          data: { projectId, parentId, index, isDir, fileType: type },
        },
        queryClient,
      )
    },
    [projectId, runCommand, queryClient],
  )

  const onRename: RenameHandler<FileTreeNode> = async ({ id, name }) => {
    if (!name.trim()) {
      if (id.startsWith("temp-")) {
        const node = findNodeInTree(treeData, id)
        const parentId = node?.parentId ?? rootFolderId
        removeNodeFromCache(queryClient, projectId, parentId, id)
      }
      return
    }

    if (id.startsWith("temp-")) {
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
        type: node.directory ? null : (node.type ?? "document"),
        format: node.directory
          ? null
          : (node.format ?? defaultFormatForType(node.type ?? "document")),
        // editable: node.editable
      }

      createMutation.mutate(payload, {
        onSettled(created, error) {
          removeNodeFromCache(queryClient, projectId, parentId, id)
          if (error || !created) {
            console.error("Failed to create file node:", error)
            return
          }
          insertNodeInCache(
            queryClient,
            projectId,
            parentId,
            node.directory ? { ...created, children: [] } : created,
          )
          appendDirectoryChild(queryClient, projectId, parentId, {
            ...created,
            previewUrl: null,
          })
          void queryClient.invalidateQueries({
            queryKey: directoryChildrenKey(projectId, parentId),
          })
          if (!created.directory) {
            openFile(created)
          }
        },
      })
      return
    }

    const node = findNodeInTree(treeData, id)
    if (!node || node.name === name.trim()) return

    const parentId = node.parentId ?? rootFolderId
    updateDirectoryChild(queryClient, projectId, parentId, id, {
      name: name.trim(),
    })
    try {
      const updated = await renameMutation.mutateAsync({
        fileId: id,
        name: name.trim(),
      })
      updateDirectoryChild(queryClient, projectId, parentId, id, {
        name: updated.name,
        path: updated.path,
      })
      updateTab(id, {
        name: updated.name,
        path: updated.path,
        oldPath: node.path,
      })
    } catch (err) {
      console.error("Failed to rename:", err)
      updateDirectoryChild(queryClient, projectId, parentId, id, {
        name: node.name,
      })
    }
  }

  const onMove: MoveHandler<FileTreeNode> = async ({
    dragIds,
    parentId,
    index,
  }) => {
    const fileId = dragIds[0]
    if (!fileId) return

    const resolvedParentId = parentId ?? rootFolderId

    const parentNode = parentId ? findNodeInTree(treeData, parentId) : null
    const siblings = parentNode ? (parentNode.children ?? []) : treeData
    const filteredSiblings = siblings.filter((s) => s.id !== fileId)

    let position: "start" | "end" | "before" | "after"
    let anchorId: string | null = null

    if (filteredSiblings.length === 0 || index === 0) {
      position = "start"
    } else if (index >= filteredSiblings.length) {
      position = "end"
    } else {
      anchorId = filteredSiblings[index - 1]?.id ?? null
      position = anchorId ? "after" : "start"
    }

    const node = findNodeInTree(treeData, fileId)
    if (!node) return

    const oldParentId = node.parentId ?? rootFolderId
    const parentWasLoaded = isDirLoaded(
      queryClient,
      projectId,
      resolvedParentId,
    )

    removeDirectoryChild(queryClient, projectId, oldParentId, fileId)
    const clampedIndex = Math.min(index, filteredSiblings.length)

    if (parentWasLoaded) {
      insertNodeInCache(
        queryClient,
        projectId,
        resolvedParentId,
        { ...node, parentId: resolvedParentId },
        clampedIndex,
      )
    } else if (parentId) {
      await queryClient.ensureQueryData(
        getlistFileTreePerDirectoryOptions(projectId, parentId),
      )
    }

    try {
      const updated = await moveMutation.mutateAsync({
        fileId,
        parentId: resolvedParentId,
        anchorId,
        position,
      })
      if (parentWasLoaded) {
        updateNodeInCache(queryClient, projectId, resolvedParentId, fileId, {
          path: updated.path,
          name: updated.name,
          parentId: resolvedParentId,
        })
      }
      updateTab(fileId, {
        name: updated.name,
        path: updated.path,
        oldPath: node.path,
      })
      void queryClient.invalidateQueries({
        queryKey: directoryChildrenKey(projectId, oldParentId),
      })
      void queryClient.invalidateQueries({
        queryKey: directoryChildrenKey(projectId, resolvedParentId),
      })
      void queryClient.invalidateQueries({
        queryKey: fileTreeKey(projectId, oldParentId),
      })
      void queryClient.invalidateQueries({
        queryKey: fileTreeKey(projectId, resolvedParentId),
      })
    } catch (err) {
      console.error("Failed to move:", err)
      void queryClient.invalidateQueries({
        queryKey: directoryChildrenKey(projectId, oldParentId),
      })
      void queryClient.invalidateQueries({
        queryKey: directoryChildrenKey(projectId, resolvedParentId),
      })
      void queryClient.invalidateQueries({
        queryKey: fileTreeKey(projectId, oldParentId),
      })
      void queryClient.invalidateQueries({
        queryKey: fileTreeKey(projectId, resolvedParentId),
      })
    }
  }

  const onDelete: DeleteHandler<FileTreeNode> = async ({ ids }) => {
    for (const id of ids) {
      const node = findNodeInTree(treeData, id)
      if (!node) continue

      const confirmed = window.confirm(
        node.directory
          ? `Delete folder "${node.name}" and all of its contents? This cannot be undone.`
          : `Delete file "${node.name}"? This cannot be undone.`,
      )
      if (!confirmed) continue

      const fileIdsToClose = collectDescendantFileIds(node)
      const parentId = node.parentId ?? rootFolderId
      removeDirectoryChild(queryClient, projectId, parentId, id)
      if (!id.startsWith("temp-")) {
        try {
          await deleteMutation.mutateAsync(id)
          for (const fileId of fileIdsToClose) {
            closeTab(fileId)
          }
          void queryClient.invalidateQueries({
            queryKey: directoryChildrenKey(projectId, parentId),
          })
        } catch (err) {
          console.error("Failed to delete:", err)
          void queryClient.invalidateQueries({
            queryKey: directoryChildrenKey(projectId, parentId),
          })
          void queryClient.invalidateQueries({
            queryKey: fileTreeKey(projectId, parentId),
          })
        }
      }
    }
  }

  const disableDrag = useCallback(
    (node: FileTreeNode) => node.id.startsWith("temp-") || !node.editable,
    [],
  )

  const nodeRenderer = useCallback(
    (props: NodeRendererProps<FileTreeNode>) => (
      <div className="min-w-0 w-full overflow-hidden">
        <Node {...props} onCreateFile={createFileNode} />
      </div>
    ),
    [createFileNode],
  )

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateTreeHeight = () => {
      setTreeHeight(Math.floor(container.getBoundingClientRect().height))
    }

    updateTreeHeight()
    const resizeObserver = new ResizeObserver(updateTreeHeight)
    resizeObserver.observe(container)
    const animationFrameId = window.requestAnimationFrame(updateTreeHeight)

    return () => {
      window.cancelAnimationFrame(animationFrameId)
      resizeObserver.disconnect()
    }
  }, [storeRootFolderId])

  if (!storeRootFolderId) return null

  return (
    <div ref={containerRef} className="min-h-0 min-w-0 flex-1 overflow-hidden">
      <Tree<FileTreeNode>
        ref={setTree}
        dndManager={dndManager}
        data={treeData}
        idAccessor="id"
        childrenAccessor="children"
        openByDefault={false}
        indent={16}
        rowHeight={28}
        width="100%"
        height={treeHeight || undefined}
        paddingBottom={20}
        disableDrag={disableDrag}
        // disableDrop={(args) => !args.parentNode.data.directory}
        onRename={onRename}
        onMove={onMove}
        onDelete={onDelete}
        renderRow={FileTreeRow}
        className="scrollbar-hide overflow-x-hidden"
      >
        {nodeRenderer}
      </Tree>
    </div>
  )
}

function findNodeInTree(
  nodes: Array<FileTreeNode>,
  id: string,
): FileTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    if (node.children) {
      const found = findNodeInTree(node.children, id)
      if (found) return found
    }
  }
  return null
}

function collectDescendantFileIds(node: FileTreeNode): Array<string> {
  if (!node.directory) return [node.id]

  const ids: Array<string> = []
  for (const child of node.children ?? []) {
    ids.push(...collectDescendantFileIds(child))
  }
  return ids
}
