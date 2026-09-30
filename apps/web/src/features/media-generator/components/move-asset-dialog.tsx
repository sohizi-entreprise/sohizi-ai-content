import { useState } from "react"
import { Folder } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@sohizi/ui/button"
import { Input } from "@sohizi/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@sohizi/ui/dialog"
import { useFolderSearch } from "@/hooks/use-folder-search"
import { cn } from "@/lib/utils"

type MoveAssetDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  assetName: string
  onMoveToFolder: (folderId: string) => Promise<{ ok: boolean }>
}

export function MoveAssetDialog({
  open,
  onOpenChange,
  projectId,
  assetName,
  onMoveToFolder,
}: MoveAssetDialogProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const {
    folderQuery,
    setFolderQuery,
    trimmedDebouncedFolderQuery,
    folderOptions,
    isSearchingFolders,
  } = useFolderSearch(projectId, open)
  const selectedFolder = folderOptions.find(
    (folder) => folder.id === selectedFolderId,
  )

  const resetAndClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setFolderQuery("")
      setSelectedFolderId(null)
    }
    onOpenChange(nextOpen)
  }

  const confirmMove = async () => {
    if (!selectedFolder) return

    const { ok } = await onMoveToFolder(selectedFolder.id)
    if (!ok) {
      toast.error("Failed to move asset")
      return
    }

    toast.success(`Moved ${assetName} to ${selectedFolder.name}`)
    resetAndClose(false)
  }

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
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
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-md p-1">
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
          <Button variant="outline" onClick={() => resetAndClose(false)}>
            Cancel
          </Button>
          <Button disabled={!selectedFolder} onClick={confirmMove}>
            Confirm move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
