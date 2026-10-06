import { ArrowDown, ArrowUp, MoreHorizontal, Pencil, Trash } from "lucide-react"
import { useState } from "react"
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@sohizi/ui/menubar"
import { useEditorStore } from "../../stores/editor-store"
import { useFileTreeStore } from "../../stores/file-tree-store"
import { DirectoryNode } from "../file-node/node-directory"
import { getFileIcon } from "../../utils/get-file-icon"
import { FILE_TYPE_OPTIONS } from "./node-menu"
import type { FileNodeType, FileTreeNode, NodeProps } from "../../types"
import { cn } from "@/lib/utils"

export function DocumentNode(props: NodeProps) {
  const { node, style, dragHandle } = props
  const selectedFileId = useEditorStore((s) => s.selectedFileId)
  const openFile = useEditorStore((s) => s.openFile)
  const isSelected = selectedFileId === node.data.id
  const isDir = node.data.directory

  const handleClick = () => {
    openFile(node.data)
  }

  if (isDir) {
    return <DirectoryNode {...props} />
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
      onClick={handleClick}
      data-type={node.data.type}
      data-format={node.data.format}
      data-fileid={node.data.id}
    >
      <span className="w-4 shrink-0" />
      {getFileIcon(node.data.type, node.data.format, node.data.name)}
      {node.isEditing ? (
        <input
          autoFocus
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
      <FileMenu {...props} />
    </div>
  )
}

function FileMenu({ node, tree, onCreateFile }: NodeProps) {
  const [activeInsertSubmenu, setActiveInsertSubmenu] = useState<
    "above" | "below" | null
  >(null)
  const rootFolderId = useFileTreeStore((state) => state.rootFolderId)
  const isRoot = node.level === 0
  const parentId = isRoot ? rootFolderId : (node.parent?.id ?? null)
  const siblings = isRoot ? tree.root.children : node.parent!.children

  if (node.isEditing) return null

  const createSiblingFile = (
    placement: "above" | "below",
    type: FileNodeType,
  ) => {
    const idx = siblings?.findIndex((s) => s.id === node.id) ?? 0
    if (!parentId) return
    onCreateFile(parentId, placement === "above" ? idx : idx + 1, false, type)
  }

  const onChange = (action: string) => {
    switch (action) {
      case "rename":
        node.edit()
        break

      case "delete":
        tree.delete(node.id)
        break

      default:
        break
    }
  }

  const options = getOptions(node.data)
  const closeInsertSubmenus = () => setActiveInsertSubmenu(null)
  const parentType = node.parent?.data.type
  const lockedTypeOption = parentType
    ? FILE_TYPE_OPTIONS.find((option) => option.value === parentType)
    : undefined

  return (
    <Menubar
      className="h-auto shrink-0 border-0 bg-transparent p-0 shadow-none"
      onClick={(e) => e.stopPropagation()}
    >
      <MenubarMenu>
        <MenubarTrigger asChild>
          <button
            type="button"
            className="flex shrink-0 items-center justify-center px-1! cursor-pointer rounded-sm text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:bg-accent/50 hover:text-foreground data-[state=open]:opacity-100"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="size-3.5" />
          </button>
        </MenubarTrigger>
        <MenubarContent
          align="start"
          side="bottom"
          className="min-w-40"
          onCloseAutoFocus={(e) => e.preventDefault()}
          onClick={(e) => e.stopPropagation()}
        >
          {lockedTypeOption ? (
            <>
              <MenubarItem
                onClick={() =>
                  createSiblingFile("above", lockedTypeOption.value)
                }
              >
                <ArrowUp className="size-4" />
                Insert {lockedTypeOption.label} above
              </MenubarItem>
              <MenubarItem
                onClick={() =>
                  createSiblingFile("below", lockedTypeOption.value)
                }
              >
                <ArrowDown className="size-4" />
                Insert {lockedTypeOption.label} below
              </MenubarItem>
            </>
          ) : (
            <>
              <MenubarSub
                open={activeInsertSubmenu === "above"}
                onOpenChange={(open) =>
                  setActiveInsertSubmenu(open ? "above" : null)
                }
              >
                <MenubarSubTrigger>
                  <ArrowUp className="size-4" />
                  Insert above
                </MenubarSubTrigger>
                <MenubarSubContent onClick={(e) => e.stopPropagation()}>
                  {FILE_TYPE_OPTIONS.map((option) => (
                    <MenubarItem
                      key={option.value}
                      onClick={() => createSiblingFile("above", option.value)}
                    >
                      {option.label}
                    </MenubarItem>
                  ))}
                </MenubarSubContent>
              </MenubarSub>
              <MenubarSub
                open={activeInsertSubmenu === "below"}
                onOpenChange={(open) =>
                  setActiveInsertSubmenu(open ? "below" : null)
                }
              >
                <MenubarSubTrigger>
                  <ArrowDown className="size-4" />
                  Insert below
                </MenubarSubTrigger>
                <MenubarSubContent onClick={(e) => e.stopPropagation()}>
                  {FILE_TYPE_OPTIONS.map((option) => (
                    <MenubarItem
                      key={option.value}
                      onClick={() => createSiblingFile("below", option.value)}
                    >
                      {option.label}
                    </MenubarItem>
                  ))}
                </MenubarSubContent>
              </MenubarSub>
            </>
          )}
          {options.map((option) => (
            <MenubarItem
              key={option.value}
              onClick={() => onChange(option.value)}
              onFocus={closeInsertSubmenus}
              onPointerMove={closeInsertSubmenus}
            >
              {option.icon ?? null}
              {option.label}
            </MenubarItem>
          ))}
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  )
}

function getOptions(
  node: FileTreeNode,
): Array<{ label: string; value: string; icon: React.ReactNode }> {
  if (node.editable) {
    return [
      { label: "Rename", value: "rename", icon: <Pencil className="size-4" /> },
      { label: "Delete", value: "delete", icon: <Trash className="size-4" /> },
    ]
  }
  return []
}
