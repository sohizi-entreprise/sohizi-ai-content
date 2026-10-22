import { useEffect, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { IconCaretDownFilled, IconCaretRightFilled } from "@tabler/icons-react"
import { useEditorStore } from "../../stores/editor-store"
import { getDirectoryIcon } from "../../utils/get-file-icon"
import { canCreateFileTypeInFolder } from "./node-menu"
import { DirectoryActionsMenu } from "./file-node-actions"
import { useNewAssetDialog } from "./new-asset-dialog"
import type { FileNodeType, NodeProps } from "../../types"
import { getlistFileTreePerDirectoryOptions } from "@/features/projects/query-mutation"
import { cn } from "@/lib/utils"

export function DirectoryNode(props: NodeProps) {
  const { node, tree, onCreateFile, style, dragHandle } = props
  const nameInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const { openNewAsset } = useNewAssetDialog()
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

  useDirectoryChildren(node.data.projectId, node.data.id, isDir && node.isOpen)

  const handleClick = () => {
    if (isDir) {
      node.toggle()
    } else {
      openFile(node.data)
    }
  }

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") node.submit((e.target as HTMLInputElement).value)
    if (e.key === "Escape") node.reset()
  }

  const onInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    node.submit(e.target.value)
  }

  const onInputClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()
  }

  const ensureChildrenLoaded = () =>
    queryClient.ensureQueryData(
      getlistFileTreePerDirectoryOptions(node.data.projectId, node.data.id),
    )

  const createFile = async (type: FileNodeType) => {
    if (!canCreateFileTypeInFolder(type, node.data.type)) return
    if (!node.isOpen) node.open()
    await ensureChildrenLoaded()
    onCreateFile(node.data.id, 0, false, type)
  }

  const createFolder = async () => {
    if (!node.isOpen) node.open()
    await ensureChildrenLoaded()
    onCreateFile(node.data.id, 0, true)
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
      <span className="flex size-4 shrink-0 items-center justify-center">
        {node.isOpen ? (
          <IconCaretDownFilled className="size-3" />
        ) : (
          <IconCaretRightFilled className="size-3" />
        )}
      </span>

      {getDirectoryIcon(node.isOpen, node.data.editable, node.data.name)}

      {node.isEditing ? (
        <input
          ref={nameInputRef}
          className="min-w-0 flex-1 rounded-sm border border-primary/50 bg-background px-1 text-sm outline-none"
          defaultValue={node.data.name}
          onBlur={onInputBlur}
          onKeyDown={onInputKeyDown}
          onClick={onInputClick}
        />
      ) : (
        <span className="min-w-0 flex-1 truncate" title={node.data.name}>
          {node.data.name}
        </span>
      )}
      {node.isEditing ? null : (
        <DirectoryActionsMenu
          editable={node.data.editable}
          folderType={node.data.type}
          onNewFolder={createFolder}
          onNewFile={createFile}
          onNewAsset={() => void openNewAsset(node.data.id)}
          onRename={() => node.edit()}
          onDelete={() => tree.delete(node.id)}
        />
      )}
    </div>
  )
}

function useDirectoryChildren(
  projectId: string,
  dirId: string,
  enabled: boolean,
) {
  return useQuery({
    ...getlistFileTreePerDirectoryOptions(projectId, dirId),
    enabled,
  })
}
