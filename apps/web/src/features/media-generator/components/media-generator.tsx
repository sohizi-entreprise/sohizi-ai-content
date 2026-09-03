import { Download, Folder, ImagePlus, Sparkles, Trash2, X } from "lucide-react"
import { useParams } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { useInfiniteQuery, useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { ScrollArea } from "@sohizi/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger } from "@sohizi/ui/tabs"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@sohizi/ui/resizable"
import { Button } from "@sohizi/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@sohizi/ui/dialog"
import { Input } from "@sohizi/ui/input"
import {
  bulkDeleteAssetsMutationOptions,
  bulkMoveAssetsToFolderMutationOptions,
  downloadAssetsZipMutationOptions,
  listAiGeneratedAssetsQueryOptions,
} from "../query-mutations"
import MediaCardRenderer from "./media-card-renderer"
import MediaComposer from "./media-composer"
import type { MediaFilter } from "../types"
import { cn } from "@/lib/utils"
import { useFolderSearch } from "@/hooks/use-folder-search"

const mediaFilterOptions = [
  {
    label: "All",
    value: "all",
  },
  {
    label: "Image",
    value: "image",
  },
  {
    label: "Video",
    value: "video",
  },
  {
    label: "Audio",
    value: "audio",
  },
  {
    label: "HTML",
    value: "html",
  },
]

export function MediaGenerator() {
  const { projectId } = useParams({
    from: "/dashboard/projects/$projectId",
  })

  const [filter, setFilter] = useState<MediaFilter>("all")

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full w-full">
      <ResizablePanel
        id="editor-workspace"
        defaultSize={65}
        minSize={50}
        className="bg-card rounded-2xl"
      >
        <div className="flex h-full w-full flex-col">
          <RenderHeader filter={filter} setFilter={setFilter} />

          <ScrollArea className="flex-1 min-h-0 px-4">
            <RenderAssets projectId={projectId} filter={filter} />
          </ScrollArea>
        </div>
      </ResizablePanel>
      <ResizableHandle className="mx-1 bg-transparent" />
      <ResizablePanel
        id="file-explorer"
        defaultSize={35}
        minSize={30}
        // maxSize={40}
        className="rounded-2xl mb-2 bg-card"
      >
        <MediaComposer projectId={projectId} />
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

function RenderAssets({
  projectId,
  filter,
}: {
  projectId: string
  filter: MediaFilter
}) {
  const listOptions = filter === "all" ? undefined : { type: filter }
  const { data: requests, isLoading } = useInfiniteQuery(
    listAiGeneratedAssetsQueryOptions(projectId, listOptions),
  )
  const [selectedAssetIds, setSelectedAssetIds] = useState<Array<string>>([])

  useEffect(() => {
    if (!requests) return
    const currentAssetIds = new Set(
      requests.flatMap((request) => request.assets.map((asset) => asset.id)),
    )
    setSelectedAssetIds((current) =>
      current.filter((assetId) => currentAssetIds.has(assetId)),
    )
  }, [requests])

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">...loading</div>
    )
  }

  if (!requests || requests.length === 0) {
    return <EmptyMediaState />
  }

  const onSelectedChange = (assetId: string, selected: boolean) => {
    setSelectedAssetIds((current) => {
      if (selected) {
        return current.includes(assetId) ? current : [...current, assetId]
      }
      return current.filter((currentAssetId) => currentAssetId !== assetId)
    })
  }

  const clearSelection = () => setSelectedAssetIds([])

  return (
    <div className="py-8">
      <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {requests.map((request) => (
          <MediaCardRenderer
            key={request.id}
            item={request}
            projectId={projectId}
            selectedAssetIds={selectedAssetIds}
            onSelectedChange={onSelectedChange}
          />
        ))}
      </div>
      <BulkAssetActionBar
        projectId={projectId}
        selectedAssetIds={selectedAssetIds}
        onClearSelection={clearSelection}
      />
    </div>
  )
}

function RenderHeader(props: {
  filter: MediaFilter
  setFilter: (filter: MediaFilter) => void
}) {
  const { filter, setFilter } = props
  return (
    <header className="px-4 pt-4 pb-2 flex items-center justify-between relative z-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-primary">
            <Sparkles className="size-4" />
            AI media
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-white">
            Media generator history
          </h1>
        </div>
      </div>

      <Tabs
        value={filter}
        onValueChange={(value) => setFilter(value as MediaFilter)}
        // className="mt-5"
      >
        <TabsList className="h-11 rounded-2xl border bg-black/40 p-1">
          {mediaFilterOptions.map((option) => (
            <TabsTrigger
              key={option.value}
              value={option.value}
              className={cn(
                "rounded-xl px-5 text-sm text-zinc-300",
                "data-[state=active]:bg-white/15 data-[state=active]:text-white",
              )}
            >
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </header>
  )
}

function BulkAssetActionBar({
  projectId,
  selectedAssetIds,
  onClearSelection,
}: {
  projectId: string
  selectedAssetIds: Array<string>
  onClearSelection: () => void
}) {
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const selectedCount = selectedAssetIds.length
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

  const moveMutation = useMutation(
    bulkMoveAssetsToFolderMutationOptions(projectId),
  )
  const deleteMutation = useMutation(bulkDeleteAssetsMutationOptions(projectId))
  const downloadMutation = useMutation(
    downloadAssetsZipMutationOptions(projectId),
  )
  const isBusy =
    moveMutation.isPending ||
    deleteMutation.isPending ||
    downloadMutation.isPending

  const openMoveDialog = () => {
    setFolderQuery("")
    setSelectedFolderId(null)
    setMoveDialogOpen(true)
  }

  const confirmMove = async () => {
    if (!selectedFolder || selectedCount === 0) return

    try {
      await moveMutation.mutateAsync({
        assetIds: selectedAssetIds,
        folderId: selectedFolder.id,
      })
      toast.success(
        `Moved ${selectedCount} asset${selectedCount > 1 ? "s" : ""} to ${selectedFolder.name}`,
      )
      setMoveDialogOpen(false)
      onClearSelection()
    } catch {
      toast.error("Failed to move selected assets")
    }
  }

  const deleteSelectedAssets = async () => {
    if (selectedCount === 0) return
    const ok = confirm(
      `Delete ${selectedCount} selected asset${selectedCount > 1 ? "s" : ""}?`,
    )
    if (!ok) return

    try {
      await deleteMutation.mutateAsync(selectedAssetIds)
      toast.success(
        `Deleted ${selectedCount} asset${selectedCount > 1 ? "s" : ""}`,
      )
      onClearSelection()
    } catch {
      toast.error("Failed to delete selected assets")
    }
  }

  const downloadSelectedAssets = async () => {
    if (selectedCount === 0) return

    try {
      const blob = await downloadMutation.mutateAsync(selectedAssetIds)
      downloadBlob(blob, "generated-assets.zip")
      toast.success(
        `Downloading ${selectedCount} asset${selectedCount > 1 ? "s" : ""}`,
      )
    } catch {
      toast.error("Failed to download selected assets")
    }
  }

  if (selectedCount === 0) {
    return null
  }

  return (
    <>
      <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-background/95 px-3 py-2 shadow-lg backdrop-blur">
        <span className="px-2 text-sm text-muted-foreground">
          {selectedCount} selected
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={openMoveDialog}
          disabled={isBusy}
        >
          <Folder className="size-4" />
          Move
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={downloadSelectedAssets}
          disabled={isBusy}
        >
          <Download className="size-4" />
          Download
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={deleteSelectedAssets}
          disabled={isBusy}
        >
          <Trash2 className="size-4" />
          Delete
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={onClearSelection}
          disabled={isBusy}
          aria-label="Clear selection"
        >
          <X className="size-4" />
        </Button>
      </div>
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move selected assets</DialogTitle>
            <DialogDescription>
              Search for a folder and confirm where the selected assets should
              be moved.
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
            <Button
              variant="outline"
              onClick={() => setMoveDialogOpen(false)}
              disabled={moveMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              disabled={!selectedFolder || moveMutation.isPending}
              onClick={confirmMove}
            >
              Confirm move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function EmptyMediaState() {
  return (
    <div className="flex min-h-[420px] items-center justify-center">
      <div className="max-w-sm text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-card">
          <ImagePlus className="size-6" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-foreground">
          No media generated yet
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Use the media settings to create mock images, videos, or audio for
          this project.
        </p>
      </div>
    </div>
  )
}
