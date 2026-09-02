import { useState } from "react"
import {
  Download,
  Eye,
  FilePlus2,
  Folder,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { useAssetMenu } from "../hooks/use-asset-menu"
import AudioPlayer from "./audio-player"
import { RenderHtml } from "./html-asset-preview"
import { MediaCardMenu } from "./media-card-menu"
import { RequestSettingsDialog } from "./request-settings-dialog"
import type { MediaAsset } from "../requests"
import { Button } from "@sohizi/ui/button"
import { Input } from "@sohizi/ui/input"
import { cn } from "@/lib/utils"
import {
  buildOptimizeddImageUrl,
  imageUrlTransforms,
} from "@/utils/transform-url"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@sohizi/ui/dialog"
import { useFolderSearch } from "@/hooks/use-folder-search"
import { Checkbox } from "@sohizi/ui/checkbox"

type MediaCardProps = {
  item: MediaAsset
  projectId: string
  selected?: boolean
  onSelectedChange?: (assetId: string, selected: boolean) => void
}

export function MediaCard({
  item,
  projectId,
  selected = false,
  onSelectedChange,
}: MediaCardProps) {
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
      <RouteMediaAsset item={item} />
      <CardMenu
        asset={item}
        projectId={projectId}
        className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100 transition-opacity duration-300"
      />
    </div>
  )
}

function RouteMediaAsset({ item }: { item: MediaAsset }) {
  switch (item.type) {
    case "image":
      return <RenderImage item={item} />
    case "video":
      return <RenderVideo item={item} />
    case "audio":
      return <RenderAudio item={item} />
    case "html":
      return <RenderHtml item={item} />
  }
}

function RenderImage({ item }: { item: MediaAsset }) {
  const previewUrl = buildOptimizeddImageUrl(
    item.url,
    imageUrlTransforms.previews.contentCard,
  )
  const thumbnailUrl = buildOptimizeddImageUrl(
    item.url,
    imageUrlTransforms.thumbnails.large,
  )
  const blurryPlaceholderUrl = buildOptimizeddImageUrl(
    item.url,
    imageUrlTransforms.blurryPlaceholder,
  )
  return (
    <Dialog>
      <DialogTrigger className="size-full">
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
      </DialogTrigger>
      <DialogContent
        className="md:max-w-6xl bg-surface/30 backdrop-blur-sm"
        showCloseButton={false}
      >
        <div className="aspect-video w-full">
          <img
            className="size-full object-contain"
            src={previewUrl}
            alt={item.name}
          />
        </div>
        <DialogClose asChild>
          <Button
            size="icon"
            className="absolute -top-4 -right-4 rounded-full bg-surface border backdrop-blur-sm hover:bg-surface hover:scale-105 transition-all duration-300"
          >
            <X className="size-4 text-foreground" />
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  )
}

function RenderVideo({ item }: { item: MediaAsset }) {
  return (
    <div className="size-full">
      <video className="size-full object-contain" src={item.url} controls />
    </div>
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
  asset,
  projectId,
}: {
  className?: string
  asset: MediaAsset
  projectId: string
}) {
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const { onDelete, onReuseSettings, onDownload, onMoveToFolder } =
    useAssetMenu(projectId, asset)
  const {
    folderQuery,
    setFolderQuery,
    trimmedDebouncedFolderQuery,
    folderOptions,
    isSearchingFolders,
  } = useFolderSearch(projectId, moveDialogOpen)
  const selectedFolder = folderOptions.find(
    (folder) => folder.id === selectedFolderId,
  )

  const openMoveDialog = () => {
    setFolderQuery("")
    setSelectedFolderId(null)
    setMoveDialogOpen(true)
  }

  const confirmMove = async () => {
    if (!selectedFolder) return

    const { ok } = await onMoveToFolder(selectedFolder.id)
    if (!ok) {
      toast.error("Failed to move asset")
      return
    }

    toast.success(`Moved ${asset.name} to ${selectedFolder.name}`)
    setMoveDialogOpen(false)
  }

  const options = [
    {
      label: "Move to folder",
      icon: FilePlus2,
      onClick: openMoveDialog,
    },
    {
      label: "Reuse settings",
      icon: RotateCcw,
      onClick: onReuseSettings,
    },
    {
      label: "View settings",
      icon: Eye,
      onClick: () => setSettingsDialogOpen(true),
    },
    {
      label: "Download",
      icon: Download,
      onClick: async () => {
        const { ok } = await onDownload()
        if (!ok) {
          toast.error("Failed to download asset")
        }
      },
    },
    {
      label: "Delete",
      icon: Trash2,
      onClick: onDelete,
    },
  ]

  return (
    <>
      <MediaCardMenu className={className} options={options} />
      <RequestSettingsDialog
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
        request={asset.generationRequest?.request ?? null}
      />
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent onCloseAutoFocus={(event) => event.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Move to folder</DialogTitle>
            <DialogDescription>
              Search for a folder and confirm where this asset should be moved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={folderQuery}
              onChange={(event) => {
                setFolderQuery(event.target.value)
                setSelectedFolderId(null)
              }}
              placeholder="Search folders..."
            />
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-1">
              {folderOptions.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {!trimmedDebouncedFolderQuery
                    ? "Start typing to search folders"
                    : isSearchingFolders
                      ? "Searching folders..."
                      : "No folders found"}
                </div>
              ) : (
                folderOptions.map((folder) => (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => setSelectedFolderId(folder.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                      selectedFolderId === folder.id &&
                        "bg-accent text-accent-foreground",
                    )}
                  >
                    <Folder className="size-4 text-muted-foreground" />
                    <span className="truncate">{folder.name}</span>
                  </button>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveDialogOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!selectedFolder} onClick={confirmMove}>
              Confirm move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
