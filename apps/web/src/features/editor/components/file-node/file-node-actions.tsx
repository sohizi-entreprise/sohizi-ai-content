import {
  ArrowDown,
  ArrowUp,
  FilePlus,
  FolderPlus,
  ImagePlus,
  MoreHorizontal,
  Pencil,
  Trash,
} from "lucide-react"
import { useState } from "react"
import {
  Menubar,
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarMenu,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@sohizi/ui/menubar"
import { fileTypeOptionsForFolder } from "./node-menu"
import type { ReactNode } from "react"
import type { FileNodeType } from "../../types"
import { cn } from "@/lib/utils"

const listTriggerClassName =
  "flex shrink-0 items-center justify-center px-1! cursor-pointer rounded-sm text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:bg-accent/50 hover:text-foreground data-[state=open]:opacity-100"

export function FileActionsMenu({
  editable,
  parentType,
  triggerClassName,
  overlay = false,
  onInsert,
  onRename,
  onDelete,
}: {
  editable: boolean
  parentType: string | null | undefined
  triggerClassName?: string
  overlay?: boolean
  onInsert: (placement: "above" | "below", type: FileNodeType) => void
  onRename: () => void
  onDelete: () => void
}) {
  const [activeInsertSubmenu, setActiveInsertSubmenu] = useState<
    "above" | "below" | null
  >(null)
  const closeInsertSubmenus = () => setActiveInsertSubmenu(null)
  const fileTypeOptions = fileTypeOptionsForFolder(parentType)
  const lockedTypeOption = parentType ? fileTypeOptions[0] : undefined
  const options = editable
    ? [
        {
          label: "Rename",
          value: "rename",
          icon: <Pencil className="size-4" />,
        },
        {
          label: "Delete",
          value: "delete",
          icon: <Trash className="size-4" />,
        },
      ]
    : []

  return (
    <Menubar
      className={cn(
        "h-auto shrink-0 border-0 bg-transparent p-0 shadow-none",
        overlay && "absolute top-1 right-1 z-10",
      )}
      onClick={(event) => event.stopPropagation()}
    >
      <MenubarMenu>
        <MenubarTrigger asChild>
          <button
            type="button"
            className={cn(listTriggerClassName, triggerClassName)}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onDragStart={(event) => event.preventDefault()}
          >
            <MoreHorizontal className="size-3.5" />
          </button>
        </MenubarTrigger>
        <MenubarContent
          align="start"
          side="bottom"
          className="min-w-40"
          onCloseAutoFocus={(event) => event.preventDefault()}
          onClick={(event) => event.stopPropagation()}
        >
          {lockedTypeOption ? (
            <>
              <MenubarItem
                onClick={() => onInsert("above", lockedTypeOption.value)}
              >
                <ArrowUp className="size-4" />
                Insert {lockedTypeOption.label} above
              </MenubarItem>
              <MenubarItem
                onClick={() => onInsert("below", lockedTypeOption.value)}
              >
                <ArrowDown className="size-4" />
                Insert {lockedTypeOption.label} below
              </MenubarItem>
            </>
          ) : fileTypeOptions.length > 0 ? (
            <>
              <InsertSubmenu
                placement="above"
                open={activeInsertSubmenu === "above"}
                options={fileTypeOptions}
                onOpenChange={(open) =>
                  setActiveInsertSubmenu(open ? "above" : null)
                }
                onInsert={onInsert}
              />
              <InsertSubmenu
                placement="below"
                open={activeInsertSubmenu === "below"}
                options={fileTypeOptions}
                onOpenChange={(open) =>
                  setActiveInsertSubmenu(open ? "below" : null)
                }
                onInsert={onInsert}
              />
            </>
          ) : null}
          {options.map((option) => (
            <MenubarItem
              key={option.value}
              onClick={() => {
                if (option.value === "rename") onRename()
                if (option.value === "delete") onDelete()
              }}
              onFocus={closeInsertSubmenus}
              onPointerMove={closeInsertSubmenus}
            >
              {option.icon}
              {option.label}
            </MenubarItem>
          ))}
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  )
}

function InsertSubmenu({
  placement,
  open,
  options,
  onOpenChange,
  onInsert,
}: {
  placement: "above" | "below"
  open: boolean
  options: Array<{ label: string; value: FileNodeType }>
  onOpenChange: (open: boolean) => void
  onInsert: (placement: "above" | "below", type: FileNodeType) => void
}) {
  return (
    <MenubarSub open={open} onOpenChange={onOpenChange}>
      <MenubarSubTrigger>
        {placement === "above" ? (
          <ArrowUp className="size-4" />
        ) : (
          <ArrowDown className="size-4" />
        )}
        Insert {placement}
      </MenubarSubTrigger>
      <MenubarSubContent onClick={(event) => event.stopPropagation()}>
        {options.map((option) => (
          <MenubarItem
            key={option.value}
            onClick={() => onInsert(placement, option.value)}
          >
            {option.label}
          </MenubarItem>
        ))}
      </MenubarSubContent>
    </MenubarSub>
  )
}

export function DirectoryActionsMenu({
  editable,
  folderType,
  triggerClassName,
  overlay = false,
  onNewFolder,
  onNewFile,
  onNewAsset,
  onRename,
  onDelete,
}: {
  editable: boolean
  folderType: string | null | undefined
  triggerClassName?: string
  overlay?: boolean
  onNewFolder: () => void | Promise<void>
  onNewFile: (type: FileNodeType) => void | Promise<void>
  onNewAsset: () => void
  onRename: () => void
  onDelete: () => void
}) {
  const [isNewFileSubmenuOpen, setIsNewFileSubmenuOpen] = useState(false)
  const closeNewFileSubmenu = () => setIsNewFileSubmenuOpen(false)
  const fileTypeOptions = fileTypeOptionsForFolder(folderType)
  const lockedTypeOption = folderType ? fileTypeOptions[0] : undefined
  const options: Array<{
    label: string
    value: string
    icon: ReactNode
  }> = [
    {
      label: "New folder",
      value: "new-folder",
      icon: <FolderPlus className="size-4" />,
    },
    {
      label: "New asset",
      value: "new-asset",
      icon: <ImagePlus className="size-4" />,
    },
    ...(editable
      ? [
          {
            label: "Rename",
            value: "rename",
            icon: <Pencil className="size-4" />,
          },
          {
            label: "Delete",
            value: "delete",
            icon: <Trash className="size-4" />,
          },
        ]
      : []),
  ]
  const [newFolderOption, ...remainingOptions] = options

  return (
    <div
      className={cn(overlay ? "absolute top-1 right-1 z-10" : "shrink-0")}
      onClick={(event) => event.stopPropagation()}
    >
      <Menubar
        className="h-auto border-0 bg-transparent p-0 shadow-none"
        onClick={(event) => event.stopPropagation()}
      >
        <MenubarMenu>
          <MenubarTrigger asChild>
            <button
              type="button"
              className={cn(listTriggerClassName, triggerClassName)}
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
              onDragStart={(event) => event.preventDefault()}
            >
              <MoreHorizontal className="size-3.5" />
            </button>
          </MenubarTrigger>
          <MenubarContent
            align="start"
            side="bottom"
            className="min-w-40"
            onCloseAutoFocus={(event) => event.preventDefault()}
            onClick={(event) => event.stopPropagation()}
          >
            <MenubarItem
              onClick={() => void onNewFolder()}
              onFocus={closeNewFileSubmenu}
              onPointerMove={closeNewFileSubmenu}
            >
              {newFolderOption.icon}
              {newFolderOption.label}
            </MenubarItem>

            {lockedTypeOption ? (
              <MenubarItem
                onClick={() => void onNewFile(lockedTypeOption.value)}
                onFocus={closeNewFileSubmenu}
                onPointerMove={closeNewFileSubmenu}
              >
                <FilePlus className="size-4 text-muted-foreground" />
                New {lockedTypeOption.label}
              </MenubarItem>
            ) : fileTypeOptions.length > 0 ? (
              <MenubarGroup>
                <MenubarSub
                  open={isNewFileSubmenuOpen}
                  onOpenChange={setIsNewFileSubmenuOpen}
                >
                  <MenubarSubTrigger className="flex items-center gap-2 cursor-pointer rounded-sm text-foreground transition-colors hover:bg-background/50 ">
                    <FilePlus className="size-4 text-muted-foreground" />
                    New file
                  </MenubarSubTrigger>
                  <MenubarSubContent>
                    <MenubarGroup>
                      {fileTypeOptions.map((option) => (
                        <MenubarItem
                          key={option.value}
                          onClick={() => void onNewFile(option.value)}
                        >
                          {option.label}
                        </MenubarItem>
                      ))}
                    </MenubarGroup>
                  </MenubarSubContent>
                </MenubarSub>
              </MenubarGroup>
            ) : null}

            {remainingOptions.map((option) => (
              <MenubarItem
                key={option.value}
                onClick={() => {
                  if (option.value === "new-asset") onNewAsset()
                  if (option.value === "rename") onRename()
                  if (option.value === "delete") onDelete()
                }}
                onFocus={closeNewFileSubmenu}
                onPointerMove={closeNewFileSubmenu}
              >
                {option.icon}
                {option.label}
              </MenubarItem>
            ))}
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </div>
  )
}
