import { NodeRendererProps } from 'react-arborist'
import type { FileNode as BackendFileNode } from '../projects/type'

export interface FileTreeNode extends BackendFileNode {
  children?: FileTreeNode[]
}

export interface NodeProps extends NodeRendererProps<FileTreeNode> {
  onCreateFile: (parentId: string, index: number, isDir: boolean) => void
}

/**
 * @deprecated Use FileTreeNode instead
 */
export type FileNode = FileTreeNode

export interface EditorTab {
  id: string
  name: string
  extension: string
  format: FileTreeNode['format']
  pane: 'left' | 'right'
  content?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  reasoning?: string
}

export type ActivityBarItem = 'files' | 'search' | 'settings' | 'git' | 'extensions'

export type ContentType = 'text' | 'video'

export function getContentType(extension: string): ContentType {
  const videoExtensions = ['.vid', '.mp4', '.mov', '.project', '.storyboard']
  return videoExtensions.includes(extension) ? 'video' : 'text'
}

export function getFileExtension(filename: string): string {
  const idx = filename.lastIndexOf('.')
  return idx >= 0 ? filename.slice(idx) : ''
}
