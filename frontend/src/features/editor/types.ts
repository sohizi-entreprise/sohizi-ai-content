import type { NodeRendererProps } from 'react-arborist'
import type { FileNode as BackendFileNode } from '../projects/type'
import type { AiGeneratedMediaRequest } from '@/features/media-generator/types'

export interface FileTreeNode extends BackendFileNode {
  children?: Array<FileTreeNode>
}

export type FileNodeFormat = NonNullable<FileTreeNode['format']>

export interface NodeProps extends NodeRendererProps<FileTreeNode> {
  onCreateFile: (
    parentId: string,
    index: number,
    isDir: boolean,
    format?: FileNodeFormat,
  ) => void
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
  content?: string
}

export type MarkdownContent = {
  type: 'markdown'
  content: string
  revision: number
  updatedAt: string
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

export type AiGeneratedAssetsContent = {
  type: 'ai-generated-assets'
  data: Array<AiGeneratedMediaRequest>
  nextCursor: string | null
  hasMore: boolean
}

export type Skill = {
    id: string;
    name: string;
    description: string;
    instructions: string;
    fileNodeId: string | null;
    status: "draft" | "published";
    visibility: "private" | "public";
    createdAt: string;
    updatedAt: string;
}

export type SkillContent = {
  type: 'skill'
  data: Skill
}

export type FileContentResponse =
  | MarkdownContent
  | AssetContent
  | AiGeneratedAssetsContent
  | SkillContent

// ==================

export type ContentType = 'text' | 'video'


// ========================= VIDEO EDITOR ==========================
export type VideoTrackType = 'video' | 'audio' | 'text' | 'image'

export type VideoClipProperties =
  | VideoMediaClipProperties
  | AudioMediaClipProperties
  | TextClipProperties
  | ImageMediaClipProperties

export type VideoMediaClipProperties = {
  url: string
  fileName: string
  width?: number
  height?: number
  volume: number
  opacity: number
  speed: number
  borderRadius: number
}

export type AudioMediaClipProperties = {
  url: string
  fileName: string
  volume: number
  speed: number
}

export type TextClipProperties = {
  text: string
  fontSize: number
  color: string
  fontFamily: string
  fontWeight: string | number
  align: 'left' | 'center' | 'right'
  opacity: number
  xRatio: number
  yRatio: number
  widthRatio: number
  heightRatio: number
}

export type ImageMediaClipProperties = {
  url: string
  fileName: string
  width?: number
  height?: number
  opacity: number
  borderRadius: number
  blur: number
  brightness: number
  xRatio: number
  yRatio: number
  widthRatio: number
  heightRatio: number
}

export type VideoComposition = {
  id: string;
  projectId: string;
  fileNodeId: string;
  fps: number;
  durationInFrames: number;
  aspectRatio: string;
  width: number;
  height: number;
  version: number;
  createdAt: string;
  updatedAt: string;

}

export type VideoTracks = {
  id: string;
  compositionId: string;
  type: VideoTrackType;
  position: number;
  muted: boolean;
  hidden: boolean;
  createdAt: string;
  updatedAt: string;
}
  
export type VideoClips = {
  id: string;
  trackId: string;
  compositionId: string;
  type: VideoTrackType;
  startFrame: number;
  endFrame: number;
  sourceStartFrame: number;
  sourceDurationInFrames: number;
}

// ========================== PENDING OPERATIONS ==========================
export type PatchOperation = {
  type: 'patch';
  content: string;
  fileId: string;
  fileName: string;
}

export type DeleteOperation = {
  type: 'delete';
  fileId: string;
  fileName: string;
}

export type RefreshOperation = {
  type: 'refresh';
  fileId: string;
  fileName: string;
}

export type PendingFileOperation = {
  id: string;
  fileNodeId: string;
  operation: 'patch' | 'delete' | 'refresh';
  payload: PatchOperation | DeleteOperation | RefreshOperation;
  diffApplied: boolean;
  createdAt: string;
  updatedAt: string;
}