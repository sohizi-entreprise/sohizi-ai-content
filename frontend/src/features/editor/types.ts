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

export type MarkdownContent = {
  type: 'markdown'
  content: string
  revision: number
}

export type AssetContent = {
  type: 'document' | 'video' | 'audio' | 'image'
  url: string
  name: string
  metadata: {
    size: number
    contentType: string
  }
  storageKey: string
}

export type AssetType = 'document' | 'video' | 'audio' | 'image'

export type AiGeneratedAssetGroup = {
  requestId: string;
  request: Record<string, unknown> | null;
  createdAt: Date;
  assets: Array<{
      id: string;
      name: string;
      url: string;
      type: AssetType;
      createdAt: string;
      storageKey: string;
  }>;
}

export type AiGeneratedAssetsContent = {
  type: 'ai-generated-assets'
  data: AiGeneratedAssetGroup[]
  nextCursor: string | null
  hasMore: boolean
}

export type FileContentResponse = MarkdownContent | AssetContent | AiGeneratedAssetsContent

// ==================

export type ActivityBarItem = 'files' | 'search' | 'settings' | 'git' | 'extensions'

export type ContentType = 'text' | 'video'

