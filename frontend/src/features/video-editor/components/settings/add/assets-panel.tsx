import { useMemo, useState } from 'react'
import { useDrag } from 'react-dnd'
import { useQuery } from '@tanstack/react-query'
import { Film, ImageIcon, Music2, Search } from 'lucide-react'
import { ARBORIST_NODE_DRAG_TYPE } from '@/features/editor/utils/arborist-dnd'
import { useFileTreeStore } from '@/features/editor/stores/file-tree-store'
import { useProjectFileTree } from '@/features/editor/stores/file-tree-cache'
import { getFileContentQueryOptions } from '@/features/editor/query-mutations'
import type { FileTreeNode } from '@/features/editor/types'
import { useVideoEditorStore } from '../../../store/editor-store'
import { useEmptyDragPreview } from '../../../hooks/use-empty-drag-preview'
import {
  flushTimelineDropPreview,
  type LibraryAssetDragItem,
} from '../../../utils/library-dnd'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type MediaFormat = 'image' | 'video' | 'audio'

const FILTERS: Array<{ id: MediaFormat; label: string }> = [
  { id: 'image', label: 'Image' },
  { id: 'video', label: 'Video' },
  { id: 'audio', label: 'Audio' },
]

export function AssetsPanel() {
  const fileTreeProjectId = useFileTreeStore((s) => s.projectId)
  const rootFolderId = useFileTreeStore((s) => s.rootFolderId)
  const editorProjectId = useVideoEditorStore((s) => s.projectId)
  const projectId = fileTreeProjectId ?? editorProjectId
  const tree = useProjectFileTree(projectId ?? '', rootFolderId)

  const [format, setFormat] = useState<MediaFormat>('image')
  const [search, setSearch] = useState('')

  const assets = useMemo(() => {
    const all = collectMediaNodes(tree)
    const q = search.trim().toLowerCase()
    return all.filter((node) => {
      if (node.format !== format) return false
      if (!q) return true
      return node.name.toLowerCase().includes(q)
    })
  }, [tree, format, search])

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="relative shrink-0">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search assets..."
          className="h-9 rounded-lg bg-muted/50 pl-8 text-sm"
        />
      </div>

      <div className="flex shrink-0 gap-1.5 overflow-x-auto pb-0.5">
        {FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => setFormat(filter.id)}
            className={cn(
              'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
              format === filter.id
                ? 'bg-muted-foreground/25 text-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {assets.length === 0 ? (
          <div className="flex h-full min-h-24 items-center justify-center px-2 text-center">
            <p className="text-xs text-muted-foreground">
              No {format} assets found in this project
            </p>
          </div>
        ) : format === 'audio' ? (
          <ul className="flex flex-col gap-1">
            {assets.map((node) => (
              <AudioAssetRow key={node.id} node={node} />
            ))}
          </ul>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {assets.map((node) => (
              <MediaAssetTile
                key={node.id}
                node={node}
                projectId={projectId}
                format={format}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function collectMediaNodes(nodes: FileTreeNode[]): FileTreeNode[] {
  const result: FileTreeNode[] = []
  const walk = (list: FileTreeNode[]) => {
    for (const node of list) {
      if (node.directory) {
        if (node.children) walk(node.children)
        continue
      }
      if (
        node.format === 'image' ||
        node.format === 'video' ||
        node.format === 'audio'
      ) {
        result.push(node)
      }
    }
  }
  walk(nodes)
  return result
}

function useAssetDrag(nodeId: string, label: string) {
  const dragState = useDrag<LibraryAssetDragItem, void, { isDragging: boolean }>(
    () => ({
      type: ARBORIST_NODE_DRAG_TYPE,
      item: { id: nodeId, dragIds: [nodeId], fromLibrary: true, label },
      end: () => {
        flushTimelineDropPreview()
      },
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    }),
    [nodeId, label],
  )
  // Native preview is suppressed; LibraryDragLayer follows the cursor until
  // the pointer enters the timeline, then the timeline ghost takes over.
  useEmptyDragPreview(dragState[2])
  return dragState
}

function MediaAssetTile({
  node,
  projectId,
  format,
}: {
  node: FileTreeNode
  projectId: string | null
  format: 'image' | 'video'
}) {
  const [{ isDragging }, drag] = useAssetDrag(node.id, node.name)
  const { data } = useQuery({
    ...getFileContentQueryOptions(projectId ?? '', node.id),
    enabled: !!projectId && format === 'image',
  })

  const url =
    data && (data.type === 'image' || data.type === 'video') ? data.url : null

  return (
    <button
      ref={(el) => {
        drag(el)
      }}
      type="button"
      draggable={false}
      className={cn(
        'group flex cursor-grab flex-col gap-1.5 rounded-lg text-left active:cursor-grabbing',
        isDragging && 'opacity-40',
      )}
      title={`Drag "${node.name}" to timeline`}
    >
      <div className="relative aspect-square overflow-hidden rounded-lg bg-muted/70">
        {url && format === 'image' ? (
          <img
            src={url}
            alt=""
            className="size-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            {format === 'video' ? (
              <Film className="size-6" />
            ) : (
              <ImageIcon className="size-6" />
            )}
          </div>
        )}
      </div>
      <span className="truncate px-0.5 text-[11px] text-muted-foreground group-hover:text-foreground">
        {node.name}
      </span>
    </button>
  )
}

function AudioAssetRow({ node }: { node: FileTreeNode }) {
  const [{ isDragging }, drag] = useAssetDrag(node.id, node.name)

  return (
    <li>
      <button
        ref={(el) => {
          drag(el)
        }}
        type="button"
        draggable={false}
        className={cn(
          'flex w-full cursor-grab items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-muted/60 active:cursor-grabbing',
          isDragging && 'opacity-40',
        )}
        title={`Drag "${node.name}" to timeline`}
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Music2 className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-foreground">{node.name}</p>
          <p className="truncate text-xs text-muted-foreground">Audio</p>
        </div>
      </button>
    </li>
  )
}
