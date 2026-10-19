import { useEffect, useRef } from "react"
import { useEditorStore } from "../../stores/editor-store"
import { useFileTreeStore } from "../../stores/file-tree-store"
import { DirectoryNode } from "../file-node/node-directory"
import { getFileIcon } from "../../utils/get-file-icon"
import { canCreateFileTypeInFolder } from "./node-menu"
import { FileActionsMenu } from "./file-node-actions"
import type { FileNodeType, NodeProps } from "../../types"
import { cn } from "@/lib/utils"

export function DocumentNode(props: NodeProps) {
  const { node, tree, onCreateFile, style, dragHandle } = props
  const nameInputRef = useRef<HTMLInputElement>(null)
  const rootFolderId = useFileTreeStore((state) => state.rootFolderId)
  const isRoot = node.level === 0
  const parentId = isRoot ? rootFolderId : (node.parent?.id ?? null)
  const siblings = isRoot ? tree.root.children : node.parent!.children
  const selectedFileId = useEditorStore((s) => s.selectedFileId)
  const openFile = useEditorStore((s) => s.openFile)
  const isSelected = selectedFileId === node.data.id
  const isDir = node.data.directory

  useEffect(() => {
    if (!node.isEditing) return
    const frame = requestAnimationFrame(() => {
      nameInputRef.current?.focus()
      nameInputRef.current?.select()
    })
    return () => cancelAnimationFrame(frame)
  }, [node.isEditing])

  const handleClick = () => {
    openFile(node.data)
  }

  if (isDir) {
    return <DirectoryNode {...props} />
  }

  const createSiblingFile = (
    placement: "above" | "below",
    type: FileNodeType,
  ) => {
    if (!canCreateFileTypeInFolder(type, node.parent?.data.type)) return
    const idx = siblings?.findIndex((s) => s.id === node.id) ?? 0
    if (!parentId) return
    onCreateFile(parentId, placement === "above" ? idx : idx + 1, false, type)
  }

  return (
    <div
      ref={dragHandle}
      style={style}
      className={cn(
        "group flex min-w-0 w-full cursor-pointer items-center gap-1 overflow-hidden rounded-sm px-1 py-0.5 text-sm",
        isSelected
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
      onClick={(event) => {
        if (event.button === 0) handleClick()
      }}
      data-type={node.data.type}
      data-format={node.data.format}
      data-fileid={node.data.id}
    >
      <span className="w-4 shrink-0" />
      {getFileIcon(node.data.type, node.data.format, node.data.name)}
      {node.isEditing ? (
        <input
          ref={nameInputRef}
          className="min-w-0 flex-1 rounded-sm border border-primary/50 bg-background px-1 text-sm outline-none"
          defaultValue={node.data.name}
          onBlur={(e) => node.submit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter")
              node.submit((e.target as HTMLInputElement).value)
            if (e.key === "Escape") node.reset()
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="min-w-0 flex-1 truncate" title={node.data.name}>
          {node.data.name}
        </span>
      )}
      {node.isEditing ? null : (
        <FileActionsMenu
          editable={node.data.editable}
          parentType={node.parent?.data.type}
          onInsert={createSiblingFile}
          onRename={() => node.edit()}
          onDelete={() => tree.delete(node.id)}
        />
      )}
    </div>
  )
}
