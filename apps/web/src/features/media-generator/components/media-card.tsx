import { useState } from "react"
import { Download, Eye, FilePlus2, Play, RotateCcw, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Checkbox } from "@sohizi/ui/checkbox"
import { useAssetMenu } from "../hooks/use-asset-menu"
import { AssetDetailSheet } from "./asset-detail-sheet"
import AudioPlayer from "./audio-player"
import { RenderHtml } from "./html-asset-preview"
import { MediaCardMenu } from "./media-card-menu"
import { MoveAssetDialog } from "./move-asset-dialog"
import type { MediaAsset } from "../requests"
import { cn } from "@/lib/utils"
import {
  buildOptimizeddImageUrl,
  imageUrlTransforms,
  thumbnailImageUrl,
} from "@/utils/transform-url"

type MediaCardProps = {
  item: MediaAsset
  projectId: string
  selected?: boolean
  onSelectedChange?: (assetId: string, selected: boolean) => void
}

function canPreviewInSheet(asset: MediaAsset) {
  return asset.type === "image" || asset.type === "video"
}

export function MediaCard({
  item,
  projectId,
  selected = false,
  onSelectedChange,
}: MediaCardProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)
  const { onDelete, onReuseSettings, onDownload, onMoveToFolder } =
    useAssetMenu(projectId, item)
  const previewInSheet = canPreviewInSheet(item)

  const openSheet = () => setSheetOpen(true)

  const handleReuse = () => {
    onReuseSettings()
    setSheetOpen(false)
  }

  const handleDownload = async () => {
    const { ok } = await onDownload()
    if (!ok) {
      toast.error("Failed to download asset")
    }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(item.url)
      toast.success("Link copied")
    } catch {
      toast.error("Failed to copy link")
    }
  }

  const handleViewSettings = () => {
    openSheet()
  }

  return (
    <div className="group overflow-hidden rounded-md border aspect-4/3 relative">
      <div
        className={cn(
          "absolute left-1 top-1 z-10 flex size-8 items-center justify-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur transition-opacity hover:bg-black/70",
          "group-hover:opacity-100",
          selected && "opacity-100",
        )}
      >
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) =>
            onSelectedChange?.(item.id, checked === true)
          }
          onClick={(event) => event.stopPropagation()}
          aria-label={`Select ${item.name}`}
          className="border-white/80 bg-white/10 text-white data-[state=checked]:border-primary data-[state=checked]:bg-primary"
        />
      </div>
      <RouteMediaAsset
        item={item}
        onOpen={previewInSheet ? openSheet : undefined}
      />
      <CardMenu
        className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100 transition-opacity duration-300"
        onMove={() => setMoveDialogOpen(true)}
        onReuse={handleReuse}
        onViewSettings={handleViewSettings}
        onDownload={handleDownload}
        onDelete={onDelete}
      />
      <AssetDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        asset={item}
        onMove={() => setMoveDialogOpen(true)}
        onDownload={handleDownload}
        onCopyLink={handleCopyLink}
        onReuse={handleReuse}
      >
        {sheetOpen ? (
          <MoveAssetDialog
            open={moveDialogOpen}
            onOpenChange={setMoveDialogOpen}
            projectId={projectId}
            assetName={item.name}
            onMoveToFolder={onMoveToFolder}
          />
        ) : null}
      </AssetDetailSheet>
      {!sheetOpen ? (
        <MoveAssetDialog
          open={moveDialogOpen}
          onOpenChange={setMoveDialogOpen}
          projectId={projectId}
          assetName={item.name}
          onMoveToFolder={onMoveToFolder}
        />
      ) : null}
    </div>
  )
}

function RouteMediaAsset({
  item,
  onOpen,
}: {
  item: MediaAsset
  onOpen?: () => void
}) {
  switch (item.type) {
    case "image":
      return <RenderImage item={item} onOpen={onOpen} />
    case "video":
      return <RenderVideo item={item} onOpen={onOpen} />
    case "audio":
      return <RenderAudio item={item} />
    case "html":
      return <RenderHtml item={item} />
  }
}

function RenderImage({
  item,
  onOpen,
}: {
  item: MediaAsset
  onOpen?: () => void
}) {
  const thumbnailUrl = thumbnailImageUrl(item.url, "large")
  const blurryPlaceholderUrl = buildOptimizeddImageUrl(
    item.url,
    imageUrlTransforms.blurryPlaceholder,
  )
  return (
    <button type="button" className="size-full" onClick={onOpen}>
      <div
        className="size-full bg-cover bg-center"
        style={{ backgroundImage: `url(${blurryPlaceholderUrl})` }}
      >
        <img
          className="size-full object-contain"
          src={thumbnailUrl}
          alt={item.name}
        />
      </div>
    </button>
  )
}

function RenderVideo({
  item,
  onOpen,
}: {
  item: MediaAsset
  onOpen?: () => void
}) {
  return (
    <button type="button" className="relative size-full" onClick={onOpen}>
      <video
        className="size-full object-contain"
        src={item.url}
        muted
        playsInline
        preload="metadata"
      />
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="flex size-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur">
          <Play className="size-4 fill-current" />
        </span>
      </span>
    </button>
  )
}

function RenderAudio({ item }: { item: MediaAsset }) {
  return (
    <div className="size-full flex items-center justify-center">
      <AudioPlayer src={item.url} className="size-full" />
    </div>
  )
}

function CardMenu({
  className,
  onMove,
  onReuse,
  onViewSettings,
  onDownload,
  onDelete,
}: {
  className?: string
  onMove: () => void
  onReuse: () => void
  onViewSettings: () => void
  onDownload: () => void
  onDelete: () => void
}) {
  const options = [
    {
      label: "Move to folder",
      icon: FilePlus2,
      onClick: onMove,
    },
    {
      label: "Reuse settings",
      icon: RotateCcw,
      onClick: onReuse,
    },
    {
      label: "View settings",
      icon: Eye,
      onClick: onViewSettings,
    },
    {
      label: "Download",
      icon: Download,
      onClick: onDownload,
    },
    {
      label: "Delete",
      icon: Trash2,
      onClick: onDelete,
    },
  ]

  return <MediaCardMenu className={className} options={options} />
}
