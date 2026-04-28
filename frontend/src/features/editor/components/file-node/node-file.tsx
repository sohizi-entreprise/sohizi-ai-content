import {
  FileText,
  FileVideo,
  FileAudio,
  FileCode,
  File,
  ArrowUp,
  ArrowDown,
  Pencil,
  Trash,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FileTreeNode, NodeProps } from '../../types'
import { useVideoEditorStore } from '../../stores/editor-store'
import { useFileTreeStore } from '../../stores/file-tree-store'
import { DirectoryNode } from '../file-node/node-directory'
import { FileNodeMenu } from "./node-menu"


export function DocumentNode(props: NodeProps) {
    const { node, style, dragHandle } = props
    const selectedFileId = useVideoEditorStore((s) => s.selectedFileId)
    const openFile = useVideoEditorStore((s) => s.openFile)
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
          'group flex cursor-pointer items-center gap-1 rounded-sm px-1 py-0.5 text-sm',
          isSelected
            ? 'bg-accent/60 text-foreground'
            : 'text-muted-foreground hover:bg-accent/30 hover:text-foreground',
        )}
        onClick={handleClick}
      >
    
        <span className="w-4 shrink-0" />
        {getFileIcon(node.data.format)}
        {node.isEditing ? (
          <input
            autoFocus
            className="min-w-0 flex-1 rounded-sm border border-primary/50 bg-background px-1 text-sm outline-none"
            defaultValue={node.data.name}
            onBlur={(e) => node.submit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') node.submit((e.target as HTMLInputElement).value)
              if (e.key === 'Escape') node.reset()
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="min-w-0 flex-1 truncate">{node.data.name}</span>
        )}
        <FileMenu {...props} />
      </div>
    )
  }


  function getFileIcon(format: FileTreeNode['format']) {
    switch (format) {
      case 'markdown':
        return <FileText className="size-4 shrink-0 text-blue-400" />
      case 'vid':
      case 'mp4':
      case 'mov':
        return <FileVideo className="size-4 shrink-0 text-purple-400" />
      case 'mp3':
      case 'wav':
        return <FileAudio className="size-4 shrink-0 text-green-400" />
      case 'json':
      case 'js':
      case 'ts':
        return <FileCode className="size-4 shrink-0 text-yellow-400" />
      default:
        return <File className="size-4 shrink-0 text-muted-foreground" />
    }
  }

  function FileMenu({node, tree, onCreateFile}: NodeProps){

    const rootFolderId = useFileTreeStore(state => state.rootFolderId)
    const isRoot = node.level === 0
    const parentId = isRoot ? rootFolderId : (node.parent?.id ?? null)
    const siblings = isRoot ? tree.root.children : node.parent!.children

    if (node.isEditing) return null
  
    const onChange = (action: string) => {
      switch (action) {
        case 'insert-above': {
            const idx = siblings?.findIndex((s) => s.id === node.id) ?? 0
            if(!parentId) return;
            onCreateFile(parentId, idx, false)
            break;
        }
  
        case 'insert-below':{
            const idx = siblings?.findIndex((s) => s.id === node.id) ?? 0
            if(!parentId) return;
            onCreateFile(parentId, idx + 1, false)
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
        {label: 'Insert above', value: 'insert-above', icon: <ArrowUp className="size-4" />},
        {label: 'Insert below', value: 'insert-below', icon: <ArrowDown className="size-4" />},
        {label: 'Rename', value: 'rename', icon: <Pencil className="size-4" />},
        {label: 'Delete', value: 'delete', icon: <Trash className="size-4" />},
      ]
    }
    return [
      {label: 'Insert above', value: 'insert-above', icon: <ArrowUp className="size-4" />},
      {label: 'Insert below', value: 'insert-below', icon: <ArrowDown className="size-4" />},
    ]
  }
  