import {
  ArrowDown,
  ArrowUp,
  FilePlus,
  FolderPlus,
  Pencil,
  Trash,
  Upload,
} from "lucide-react"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@sohizi/ui/context-menu"
import { FILE_TYPE_OPTIONS } from "../file-node/node-menu"
import type { ReactNode } from "react"
import type { FileNodeType } from "../../types"

type MenuNode = {
  id: string
  directory: boolean
  editable: boolean
  type: string | null
}

type FileGridMenuProps = {
  node: MenuNode
  parentType: string | null
  children: ReactNode
  disabled?: boolean
  modal?: boolean
  onNewFolder: () => void
  onNewFile: (type: FileNodeType) => void
  onInsert: (placement: "above" | "below", type: FileNodeType) => void
  onRename: () => void
  onDelete: () => void
  onUpload: () => void
}

export function FileGridMenu({
  node,
  parentType,
  children,
  disabled = false,
  modal = true,
  onNewFolder,
  onNewFile,
  onInsert,
  onRename,
  onDelete,
  onUpload,
}: FileGridMenuProps) {
  const isTemp = node.id.startsWith("temp-")

  return (
    <ContextMenu modal={modal}>
      <ContextMenuTrigger asChild disabled={disabled}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent
        className="min-w-40"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        {node.directory ? (
          <FolderActions
            node={node}
            isTemp={isTemp}
            onNewFolder={onNewFolder}
            onNewFile={onNewFile}
            onUpload={onUpload}
            onRename={onRename}
            onDelete={onDelete}
          />
        ) : (
          <FileActions
            node={node}
            parentType={parentType}
            isTemp={isTemp}
            onInsert={onInsert}
            onRename={onRename}
            onDelete={onDelete}
          />
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}

function FolderActions({
  node,
  isTemp,
  onNewFolder,
  onNewFile,
  onUpload,
  onRename,
  onDelete,
}: {
  node: MenuNode
  isTemp: boolean
  onNewFolder: () => void
  onNewFile: (type: FileNodeType) => void
  onUpload: () => void
  onRename: () => void
  onDelete: () => void
}) {
  if (isTemp) {
    return (
      <>
        <ContextMenuItem onSelect={onRename}>
          <Pencil />
          Rename
        </ContextMenuItem>
        <ContextMenuItem onSelect={onDelete}>
          <Trash />
          Delete
        </ContextMenuItem>
      </>
    )
  }

  const lockedType = node.type
    ? FILE_TYPE_OPTIONS.find((option) => option.value === node.type)
    : undefined

  return (
    <>
      <ContextMenuItem onSelect={onNewFolder}>
        <FolderPlus />
        New folder
      </ContextMenuItem>
      {lockedType ? (
        <ContextMenuItem onSelect={() => onNewFile(lockedType.value)}>
          <FilePlus />
          New {lockedType.label}
        </ContextMenuItem>
      ) : (
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <FilePlus />
            New file
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {FILE_TYPE_OPTIONS.map((option) => (
              <ContextMenuItem
                key={option.value}
                onSelect={() => onNewFile(option.value)}
              >
                {option.label}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
      )}
      <ContextMenuItem onSelect={onUpload}>
        <Upload />
        Upload file
      </ContextMenuItem>
      {node.editable ? (
        <>
          <ContextMenuItem onSelect={onRename}>
            <Pencil />
            Rename
          </ContextMenuItem>
          <ContextMenuItem onSelect={onDelete}>
            <Trash />
            Delete
          </ContextMenuItem>
        </>
      ) : null}
    </>
  )
}

function FileActions({
  node,
  parentType,
  isTemp,
  onInsert,
  onRename,
  onDelete,
}: {
  node: MenuNode
  parentType: string | null
  isTemp: boolean
  onInsert: (placement: "above" | "below", type: FileNodeType) => void
  onRename: () => void
  onDelete: () => void
}) {
  const lockedType = parentType
    ? FILE_TYPE_OPTIONS.find((option) => option.value === parentType)
    : undefined

  return (
    <>
      {isTemp ? null : lockedType ? (
        <>
          <ContextMenuItem onSelect={() => onInsert("above", lockedType.value)}>
            <ArrowUp />
            Insert {lockedType.label} above
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => onInsert("below", lockedType.value)}>
            <ArrowDown />
            Insert {lockedType.label} below
          </ContextMenuItem>
        </>
      ) : (
        <>
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <ArrowUp />
              Insert above
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {FILE_TYPE_OPTIONS.map((option) => (
                <ContextMenuItem
                  key={option.value}
                  onSelect={() => onInsert("above", option.value)}
                >
                  {option.label}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <ArrowDown />
              Insert below
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {FILE_TYPE_OPTIONS.map((option) => (
                <ContextMenuItem
                  key={option.value}
                  onSelect={() => onInsert("below", option.value)}
                >
                  {option.label}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        </>
      )}
      {node.editable ? (
        <>
          <ContextMenuItem onSelect={onRename}>
            <Pencil />
            Rename
          </ContextMenuItem>
          <ContextMenuItem onSelect={onDelete}>
            <Trash />
            Delete
          </ContextMenuItem>
        </>
      ) : null}
    </>
  )
}
