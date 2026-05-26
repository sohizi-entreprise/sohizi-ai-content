import {
  ChevronDown,
  ChevronRight,
  FilePlus,
  Folder,
  FolderOpen,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Trash,
  Upload,
} from 'lucide-react'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { useEditorStore } from '../../stores/editor-store'
import { useFileTreeStore } from '../../stores/file-tree-store'
import { FILE_FORMAT_OPTIONS } from './node-menu'
import type { FileNodeFormat, FileTreeNode, NodeProps } from '../../types'
import { cn } from '@/lib/utils'
import * as requests from '@/features/projects/request'
import { useFileUpload } from '@/hooks/use-file-upload'
import { useSaveFileBucket } from '@/hooks/use-save-file-bucket'
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
} from '@/components/ui/menubar'

const MAX_CHILDREN_PER_DIRECTORY = 100

export function DirectoryNode(props: NodeProps) {
  const { node, style, dragHandle } = props
  const selectedFileId = useEditorStore((s) => s.selectedFileId)
  const openFile = useEditorStore((s) => s.openFile)
  const isSelected = selectedFileId === node.data.id
  const isDir = node.data.directory

  const handleLoadChildren = useLoadChildren()

  const handleClick = () => {
    if (isDir) {
      handleLoadChildren(node.data.id)
      node.toggle()
    } else {
      openFile(node.data)
    }
  }

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') node.submit((e.target as HTMLInputElement).value)
    if (e.key === 'Escape') node.reset()
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
        'group flex cursor-pointer items-center gap-1 rounded-sm px-1 py-0.5 text-sm',
        isSelected
          ? 'bg-accent/60 text-foreground'
          : 'text-muted-foreground hover:bg-accent/30 hover:text-foreground',
      )}
      onClick={handleClick}
    >
      <span className="flex size-4 shrink-0 items-center justify-center">
        {node.isOpen ? (
          <ChevronDown className="size-3" />
        ) : (
          <ChevronRight className="size-3" />
        )}
      </span>

      {node.isOpen ? (
        <FolderOpen className="size-4 shrink-0 text-primary/70" />
      ) : (
        <Folder className="size-4 shrink-0 text-primary/70" />
      )}

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
  const handleLoadChildren = useLoadChildren()
  const { openFileDialog, getInputProps } = useHandleUploadFile({
    projectId: node.data.projectId,
    node,
  })

  if (node.isEditing) return null

  const createFile = async (format: FileNodeFormat) => {
    if (!node.isOpen) node.open()
    await handleLoadChildren(node.data.id)
    onCreateFile(node.data.id, 0, false, format)
  }

  const onChange = async (action: string) => {
    switch (action) {
      case 'new-folder': {
        if (!node.isOpen) node.open()
        await handleLoadChildren(node.data.id)
        onCreateFile(node.data.id, 0, true)
        break
      }

      case 'rename':
        node.edit()
        break

      case 'delete':
        tree.delete(node.id)
        break

      case 'upload-file':
        openFileDialog()
        break

      default:
        break
    }
  }

  const options = getOptions(node.data)
  const [newFolderOption, ...remainingOptions] = options
  const closeNewFileSubmenu = () => setIsNewFileSubmenuOpen(false)

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

            <MenubarGroup>
              <MenubarSub
                open={isNewFileSubmenuOpen}
                onOpenChange={setIsNewFileSubmenuOpen}
              >
                <MenubarSubTrigger className="flex items-center gap-2 cursor-pointer rounded-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground">
                  <FilePlus className="size-4" />
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

            {/* <MenubarSub>
              <MenubarSubTrigger className="flex items-center gap-2 cursor-pointer rounded-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground">
                  <FilePlus className="size-4" />
                  New file
              </MenubarSubTrigger>
              <MenubarSubContent onClick={(e) => e.stopPropagation()}>
                {FILE_FORMAT_OPTIONS.map((format) => (
                  <MenubarItem
                    key={format.value}
                    onClick={() => createFile(format.value)}
                  >
                    {format.label}
                  </MenubarItem>
                ))}
              </MenubarSubContent>
            </MenubarSub> */}
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
      <input {...getInputProps()} className="sr-only" />
    </div>
  )
}

function getOptions(
  node: FileTreeNode,
): Array<{ label: string; value: string; icon: React.ReactNode }> {
  if (node.editable) {
    return [
      {
        label: 'New folder',
        value: 'new-folder',
        icon: <FolderPlus className="size-4" />,
      },
      {
        label: 'Upload file',
        value: 'upload-file',
        icon: <Upload className="size-4" />,
      },
      { label: 'Rename', value: 'rename', icon: <Pencil className="size-4" /> },
      { label: 'Delete', value: 'delete', icon: <Trash className="size-4" /> },
    ]
  }
  return [
    {
      label: 'New folder',
      value: 'new-folder',
      icon: <FolderPlus className="size-4" />,
    },
    {
      label: 'Upload file',
      value: 'upload-file',
      icon: <Upload className="size-4" />,
    },
  ]
}

export function useLoadChildren() {
  const projectId = useFileTreeStore((s) => s.projectId)
  const appendChildren = useFileTreeStore((s) => s.appendChildren)
  const markDirLoaded = useFileTreeStore((s) => s.markDirLoaded)
  const isDirLoaded = useFileTreeStore((s) => s.isDirLoaded)

  return useCallback(
    async (dirId: string) => {
      if (!projectId || isDirLoaded(dirId)) return
      try {
        const children = await requests.listFileTreePerDirectory(
          projectId,
          dirId,
        )
        appendChildren(dirId, children)
        markDirLoaded(dirId)
      } catch (err) {
        console.error('Failed to load children:', err)
      }
    },
    [projectId, appendChildren, markDirLoaded, isDirLoaded],
  )
}

function useHandleUploadFile(
  params: { projectId: string } & Pick<NodeProps, 'node'>,
) {
  const { projectId, node } = params
  const insertNodeAt = useFileTreeStore((s) => s.insertNodeAt)
  const { saveFile } = useSaveFileBucket()
  const [_state, { openFileDialog, getInputProps }] = useFileUpload({
    multiple: false,
    accept: 'image/*,video/*,audio/*,application/pdf,text/plain,.docx',
    maxSize: 5 * 1024 * 1024, // 5MB
    onFilesAdded: (data) => {
      const totalChildren = node.children?.length ?? 0
      if (totalChildren === MAX_CHILDREN_PER_DIRECTORY) {
        toast.error('Maximum number of children reached')
        return
      }

      for (const file of data) {
        saveFile(
          { projectId, folderId: node.id, file: file.file as File },
          {
            onSuccess: (result) => {
              const fileNode = result.fileNode
              insertNodeAt(node.id, fileNode, totalChildren)
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
