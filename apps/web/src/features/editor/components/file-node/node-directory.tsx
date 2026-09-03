import {
  ChevronDown,
  ChevronRight,
  FilePlus,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Trash,
  Upload,
} from "lucide-react"
import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useEditorStore } from "../../stores/editor-store"
import { insertNodeAt as insertNodeInCache } from "../../stores/file-tree-cache"
import { getDirectoryIcon } from "../../utils/get-file-icon"
import { FILE_FORMAT_OPTIONS } from "./node-menu"
import type { FileNodeFormat, FileTreeNode, NodeProps } from "../../types"
import { getlistFileTreePerDirectoryOptions } from "@/features/projects/query-mutation"
import { cn } from "@/lib/utils"
import { useFileUpload } from "@/hooks/use-file-upload"
import { useSaveFileBucket } from "@/hooks/use-save-file-bucket"
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

const MAX_CHILDREN_PER_DIRECTORY = 100

export function DirectoryNode(props: NodeProps) {
  const { node, style, dragHandle } = props
  const selectedFileId = useEditorStore((s) => s.selectedFileId)
  const openFile = useEditorStore((s) => s.openFile)
  const isSelected = selectedFileId === node.data.id
  const isDir = node.data.directory

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

  return (
    <div
      ref={dragHandle}
      style={style}
      className={cn(
        "group flex cursor-pointer items-center gap-1 rounded-sm px-1 py-0.5 text-sm",
        isSelected
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
      onClick={handleClick}
      data-format={node.data.format}
      data-fileid={node.data.id}
    >
      <span className="flex size-4 shrink-0 items-center justify-center">
        {node.isOpen ? (
          <ChevronDown className="size-3" />
        ) : (
          <ChevronRight className="size-3" />
        )}
      </span>

      {getDirectoryIcon(node.isOpen, node.data.editable, node.data.name)}

      {node.isEditing ? (
        <input
          autoFocus
          className="min-w-0 flex-1 rounded-sm border border-primary/50 bg-background px-1 text-sm outline-none"
          defaultValue={node.data.name}
          onBlur={onInputBlur}
          onKeyDown={onInputKeyDown}
          onClick={onInputClick}
        />
      ) : (
        <span className="min-w-0 flex-1 truncate">{node.data.name}</span>
      )}
      <DirectoryMenu {...props} />
    </div>
  )
}

function DirectoryMenu({ node, tree, onCreateFile }: NodeProps) {
  const [isNewFileSubmenuOpen, setIsNewFileSubmenuOpen] = useState(false)
  const queryClient = useQueryClient()
  const { openFileDialog, getInputProps } = useHandleUploadFile({
    projectId: node.data.projectId,
    node,
  })

  if (node.isEditing) return null

  const ensureChildrenLoaded = () =>
    queryClient.ensureQueryData(
      getlistFileTreePerDirectoryOptions(node.data.projectId, node.data.id),
    )

  const createFile = async (format: FileNodeFormat) => {
    if (!node.isOpen) node.open()
    await ensureChildrenLoaded()
    onCreateFile(node.data.id, 0, false, format)
  }

  const onChange = async (action: string) => {
    switch (action) {
      case "new-folder": {
        if (!node.isOpen) node.open()
        await ensureChildrenLoaded()
        onCreateFile(node.data.id, 0, true)
        break
      }

      case "rename":
        node.edit()
        break

      case "delete":
        tree.delete(node.id)
        break

      case "upload-file":
        openFileDialog()
        break

      default:
        break
    }
  }

  const options = getOptions(node.data)
  const [newFolderOption, ...remainingOptions] = options
  const closeNewFileSubmenu = () => setIsNewFileSubmenuOpen(false)
  const lockedFormatOption = node.data.format
    ? FILE_FORMAT_OPTIONS.find((format) => format.value === node.data.format)
    : undefined

  return (
    <div>
      <Menubar
        className="h-auto border-0 bg-transparent p-0 shadow-none"
        onClick={(e) => e.stopPropagation()}
      >
        <MenubarMenu>
          <MenubarTrigger asChild>
            <button
              type="button"
              className="flex shrink-0 items-center justify-center px-1! cursor-pointer rounded-sm text-muted-foreground transition-all opacity-0 group-hover:opacity-100 hover:bg-accent/50 hover:text-foreground data-[state=open]:opacity-100"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="size-3.5" />
            </button>
          </MenubarTrigger>
          <MenubarContent
            align="start"
            side="bottom"
            className="min-w-[160px]"
            onCloseAutoFocus={(e) => e.preventDefault()}
            onClick={(e) => e.stopPropagation()}
          >
            <MenubarItem
              onClick={() => onChange(newFolderOption.value)}
              onFocus={closeNewFileSubmenu}
              onPointerMove={closeNewFileSubmenu}
            >
              {newFolderOption.icon ?? null}
              {newFolderOption.label}
            </MenubarItem>

            {lockedFormatOption ? (
              <MenubarItem
                onClick={() => createFile(lockedFormatOption.value)}
                onFocus={closeNewFileSubmenu}
                onPointerMove={closeNewFileSubmenu}
              >
                <FilePlus className="size-4 text-muted-foreground" />
                New {lockedFormatOption.label}
              </MenubarItem>
            ) : (
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
                      {FILE_FORMAT_OPTIONS.map((format) => (
                        <MenubarItem
                          key={format.value}
                          onClick={() => createFile(format.value)}
                        >
                          {format.label}
                        </MenubarItem>
                      ))}
                    </MenubarGroup>
                  </MenubarSubContent>
                </MenubarSub>
              </MenubarGroup>
            )}

            {remainingOptions.map((option) => (
              <MenubarItem
                key={option.value}
                onClick={() => onChange(option.value)}
                onFocus={closeNewFileSubmenu}
                onPointerMove={closeNewFileSubmenu}
              >
                {option.icon ?? null}
                {option.label}
              </MenubarItem>
            ))}
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
      <input
        {...getInputProps()}
        className="sr-only"
      />
    </div>
  )
}

function getOptions(
  node: FileTreeNode,
): Array<{ label: string; value: string; icon: React.ReactNode }> {
  if (node.editable) {
    return [
      {
        label: "New folder",
        value: "new-folder",
        icon: <FolderPlus className="size-4" />,
      },
      {
        label: "Upload file",
        value: "upload-file",
        icon: <Upload className="size-4" />,
      },
      { label: "Rename", value: "rename", icon: <Pencil className="size-4" /> },
      { label: "Delete", value: "delete", icon: <Trash className="size-4" /> },
    ]
  }
  return [
    {
      label: "New folder",
      value: "new-folder",
      icon: <FolderPlus className="size-4" />,
    },
    {
      label: "Upload file",
      value: "upload-file",
      icon: <Upload className="size-4" />,
    },
  ]
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

function useHandleUploadFile(
  params: { projectId: string } & Pick<NodeProps, "node">,
) {
  const { projectId, node } = params
  const queryClient = useQueryClient()
  const { saveFile } = useSaveFileBucket()
  const [_state, { openFileDialog, getInputProps }] = useFileUpload({
    multiple: false,
    accept: "image/*,video/*,audio/*,text/plain,.docx",
    maxSize: 20 * 1024 * 1024, // 5MB
    onFilesAdded: (data) => {
      const totalChildren = node.children?.length ?? 0
      if (totalChildren === MAX_CHILDREN_PER_DIRECTORY) {
        toast.error("Maximum number of children reached")
        return
      }

      for (const file of data) {
        saveFile(
          { projectId, folderId: node.id, file: file.file as File },
          {
            onSuccess: (result) => {
              const fileNode = result.fileNode
              insertNodeInCache(
                queryClient,
                projectId,
                node.id,
                fileNode,
                totalChildren,
              )
            },
            onError: (error) => {
              toast.error(error.message)
            },
          },
        )
      }
    },
    onError: (error) => {
      toast.error(error)
    },
  })

  return {
    openFileDialog,
    getInputProps,
  }
}
