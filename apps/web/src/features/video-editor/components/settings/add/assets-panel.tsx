import { useEffect, useState } from "react"
import { useDrag } from "react-dnd"
import { useQuery } from "@tanstack/react-query"
import { Film, ImageIcon, Loader2, Music2, Search } from "lucide-react"
import { useEmptyDragPreview } from "../../../hooks/use-empty-drag-preview"
import { flushTimelineDropPreview } from "../../../utils/library-dnd"
import type { ProjectAssetFile } from "@/features/projects/type"
import type { LibraryAssetDragItem } from "../../../utils/library-dnd"
import { ARBORIST_NODE_DRAG_TYPE } from "@/features/editor/utils/arborist-dnd"
import { listProjectAssetsQueryOptions } from "@/features/projects/query-mutation"
import { Input } from "@sohizi/ui/input"
import { cn } from "@/lib/utils"
import {
  buildOptimizeddImageUrl,
  imageUrlTransforms,
} from "@/utils/transform-url"

type MediaFormat = "image" | "video" | "audio"

const FILTERS: Array<{ id: MediaFormat; label: string }> = [
  { id: "image", label: "Image" },
  { id: "video", label: "Video" },
  { id: "audio", label: "Audio" },
]

interface AssetsPanelProps {
  projectId: string
}

export function AssetsPanel({ projectId }: AssetsPanelProps) {
  const [format, setFormat] = useState<MediaFormat>("image")
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
    }, 250)
    return () => window.clearTimeout(timeoutId)
  }, [search])

  const {
    data: assets = [],
    isLoading,
    isFetching,
  } = useQuery(
    listProjectAssetsQueryOptions(projectId, {
      format,
      name: debouncedSearch || undefined,
    }),
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-col gap-3 px-3.5 pb-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search assets..."
            className="h-8 rounded-lg border-foreground/15 bg-muted/55 pl-8 text-xs shadow-none focus-visible:border-foreground/25 focus-visible:bg-muted/70 focus-visible:ring-0"
          />
          {isFetching && !isLoading ? (
            <Loader2 className="absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : null}
        </div>

        <div
          className="flex gap-4 border-b border-border/40"
          role="tablist"
          aria-label="Asset type"
        >
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              role="tab"
              aria-selected={format === filter.id}
              onClick={() => setFormat(filter.id)}
              className={cn(
                "relative pb-2 text-[11px] font-medium transition-colors",
                format === filter.id
                  ? "text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-primary/80"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3.5 pb-3.5">
        {isLoading ? (
          <div className="flex h-full min-h-28 items-center justify-center">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : assets.length === 0 ? (
          <div className="flex h-full min-h-28 flex-col items-center justify-center gap-1.5 text-center">
            <p className="text-xs text-muted-foreground">
              {debouncedSearch
                ? `No ${format} matches in assets/`
                : `No ${format} files in assets/`}
            </p>
          </div>
        ) : format === "audio" ? (
          <ul className="flex flex-col gap-1">
            {assets.map((node) => (
              <AudioAssetRow key={node.id} node={node} />
            ))}
          </ul>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {assets.map((node) => (
              <MediaAssetTile key={node.id} node={node} format={format} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function useAssetDrag(node: ProjectAssetFile, format: MediaFormat) {
  const dragState = useDrag<
    LibraryAssetDragItem,
    void,
    { isDragging: boolean }
  >(
    () => ({
      type: ARBORIST_NODE_DRAG_TYPE,
      item: {
        id: node.id,
        dragIds: [node.id],
        fromLibrary: true,
        label: node.name,
        format,
        url: node.url,
      },
      end: () => {
        flushTimelineDropPreview()
      },
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    }),
    [node.id, node.name, node.url, format],
  )
  // Native preview is suppressed; LibraryDragLayer follows the cursor until
  // the pointer enters the timeline, then the timeline ghost takes over.
  useEmptyDragPreview(dragState[2])
  return dragState
}

function MediaAssetTile({
  node,
  format,
}: {
  node: ProjectAssetFile
  format: "image" | "video"
}) {
  const [{ isDragging }, drag] = useAssetDrag(node, format)
  const thumbnailUrl =
    format === "image" && node.url
      ? buildOptimizeddImageUrl(node.url, imageUrlTransforms.thumbnails.small)
      : null

  return (
    <button
      ref={(el) => {
        drag(el)
      }}
      type="button"
      draggable={false}
      className={cn(
        "group flex cursor-grab flex-col gap-1.5 rounded-lg text-left active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
      title={`Drag "${node.name}" to timeline`}
    >
      <div className="relative aspect-square overflow-hidden rounded-xl bg-muted/70 ring-1 ring-border/40 transition-shadow group-hover:ring-border/70">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt=""
            className="size-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            {format === "video" ? (
              <Film className="size-5" />
            ) : (
              <ImageIcon className="size-5" />
            )}
          </div>
        )}
      </div>
      <span className="truncate px-0.5 text-[11px] text-muted-foreground transition-colors group-hover:text-foreground">
        {node.name}
      </span>
    </button>
  )
}

function AudioAssetRow({ node }: { node: ProjectAssetFile }) {
  const [{ isDragging }, drag] = useAssetDrag(node, "audio")

  return (
    <li>
      <button
        ref={(el) => {
          drag(el)
        }}
        type="button"
        draggable={false}
        className={cn(
          "flex w-full cursor-grab items-center gap-2.5 rounded-xl px-2 py-2 text-left ring-1 ring-transparent hover:bg-muted/55 hover:ring-border/40 active:cursor-grabbing",
          isDragging && "opacity-40",
        )}
        title={`Drag "${node.name}" to timeline`}
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
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
