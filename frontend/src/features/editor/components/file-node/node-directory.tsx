import { FileTreeNode, NodeProps } from "../../types"
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FilePlus,
  FolderPlus,
  Pencil,
  Trash,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useVideoEditorStore } from "../../stores/editor-store"
import { useFileTreeStore } from '../../stores/file-tree-store'
import { FileNodeMenu } from "./node-menu"
import { useCallback } from "react"
import * as requests from '@/features/projects/request'


export function DirectoryNode(props: NodeProps) {
  const { node, style, dragHandle } = props
  const selectedFileId = useVideoEditorStore((s) => s.selectedFileId)
  const openFile = useVideoEditorStore((s) => s.openFile)
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

        {
          node.isOpen ? <FolderOpen className="size-4 shrink-0 text-primary/70" /> : <Folder className="size-4 shrink-0 text-primary/70" />
        }

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


function DirectoryMenu({node, tree, onCreateFile}: NodeProps){

  const handleLoadChildren = useLoadChildren()

  if (node.isEditing) return null

  const onChange = async(action: string) => {
    switch (action) {
      case 'new-file':
        if (!node.isOpen) node.open()
        await handleLoadChildren(node.data.id)
        onCreateFile(node.data.id, 0, false)
        break;

      case 'new-folder':{
        if (!node.isOpen) node.open()
        await handleLoadChildren(node.data.id)
        onCreateFile(node.data.id, 0, true)
        break;
      }

      case 'rename':
        node.edit()
        break;

      case 'delete':
        tree.delete(node.id)
        break;
    
      default:
        break;
    }
  }

  const options = getOptions(node.data)

  return <FileNodeMenu onChange={onChange} options={options} />
}

function getOptions(node: FileTreeNode): {label: string, value: string, icon: React.ReactNode}[] {
  if (node.editable) {
    return [
      {label: 'New file', value: 'new-file', icon: <FilePlus className="size-4" />},
      {label: 'New folder', value: 'new-folder', icon: <FolderPlus className="size-4" />},
      {label: 'Rename', value: 'rename', icon: <Pencil className="size-4" />},
      {label: 'Delete', value: 'delete', icon: <Trash className="size-4" />},
    ]
  }
  return [
    {label: 'New file', value: 'new-file', icon: <FilePlus className="size-4" />},
    {label: 'New folder', value: 'new-folder', icon: <FolderPlus className="size-4" />},
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
        const children = await requests.listFileTreePerDirectory(projectId, dirId)
        appendChildren(dirId, children)
        markDirLoaded(dirId)
      } catch (err) {
        console.error('Failed to load children:', err)
      }
    },
    [projectId, appendChildren, markDirLoaded, isDirLoaded],
  )
}