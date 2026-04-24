import { Tree, type NodeRendererProps } from 'react-arborist'
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileText,
  FileVideo,
  FileAudio,
  FileCode,
  File,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FileNode } from '../../types'
import { useVideoEditorStore } from '../../stores/editor-store'
import { MOCK_FILE_TREE } from '../../mock-data'

function getFileIcon(name: string, isFolder: boolean, isOpen: boolean) {
  if (isFolder) {
    return isOpen ? (
      <FolderOpen className="size-4 shrink-0 text-primary/70" />
    ) : (
      <Folder className="size-4 shrink-0 text-primary/70" />
    )
  }
  const ext = name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'md':
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

function Node({ node, style, dragHandle }: NodeRendererProps<FileNode>) {
  const selectedFileId = useVideoEditorStore((s) => s.selectedFileId)
  const openFile = useVideoEditorStore((s) => s.openFile)
  const isSelected = selectedFileId === node.data.id

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
      onClick={() => {
        if (node.isLeaf) {
          openFile(node.data)
        } else {
          node.toggle()
        }
      }}
    >
      {!node.isLeaf && (
        <span className="flex size-4 shrink-0 items-center justify-center">
          {node.isOpen ? (
            <ChevronDown className="size-3" />
          ) : (
            <ChevronRight className="size-3" />
          )}
        </span>
      )}
      {node.isLeaf && <span className="w-4 shrink-0" />}
      {getFileIcon(node.data.name, !node.isLeaf, node.isOpen)}
      <span className="truncate">{node.data.name}</span>
    </div>
  )
}

export function FileTree() {
  return (
    <Tree<FileNode>
      data={MOCK_FILE_TREE}
      idAccessor="id"
      childrenAccessor="children"
      openByDefault={false}
      indent={16}
      rowHeight={28}
      width="100%"
      height={600}
      paddingBottom={20}
    >
      {Node}
    </Tree>
  )
}
