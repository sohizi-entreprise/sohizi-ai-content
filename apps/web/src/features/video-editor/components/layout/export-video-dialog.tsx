import { useEffect, useState } from "react"
import { AlertTriangle, Folder, Loader2 } from "lucide-react"
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
import { Label } from "@sohizi/ui/label"
import { useFolderSearch } from "@/hooks/use-folder-search"
import { cn } from "@/lib/utils"

type ExportVideoDialogProps = {
  projectId: string
  defaultFileName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  isSubmitting: boolean
  onConfirm: (input: { fileName: string; folderId: string }) => Promise<boolean>
}

function stripMp4Extension(value: string): string {
  return value.replace(/\.mp4$/i, "").trim()
}

export function ExportVideoDialog({
  projectId,
  defaultFileName,
  open,
  onOpenChange,
  isSubmitting,
  onConfirm,
}: ExportVideoDialogProps) {
  const [name, setName] = useState("")
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const {
    folderQuery,
    setFolderQuery,
    trimmedDebouncedFolderQuery,
    folderOptions,
    isSearchingFolders,
  } = useFolderSearch(projectId, open)

  const trimmedName = name.trim()

  useEffect(() => {
    if (!open) return
    setName(stripMp4Extension(defaultFileName) || "video")
    setFolderQuery("")
    setSelectedFolderId(null)
  }, [open, defaultFileName, setFolderQuery])

  const selectedFolder = folderOptions.find(
    (folder) => folder.id === selectedFolderId,
  )

  const canSubmit = trimmedName.length > 0 && !!selectedFolder && !isSubmitting

  const handleConfirm = async () => {
    if (!selectedFolder || !trimmedName || isSubmitting) return
    const ok = await onConfirm({
      fileName: trimmedName,
      folderId: selectedFolder.id,
    })
    if (ok) {
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onCloseAutoFocus={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Export video</DialogTitle>
          <DialogDescription>
            Choose a folder location and provide a file name for the exported
            video.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="export-video-name">File name</Label>
            <Input
              id="export-video-name"
              value={name}
              maxLength={100}
              onChange={(event) => setName(event.target.value)}
              placeholder="My video"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="export-video-folder">Location</Label>
            <Input
              id="export-video-folder"
              value={folderQuery}
              onChange={(event) => {
                setFolderQuery(event.target.value)
                setSelectedFolderId(null)
              }}
              placeholder="Search folders..."
            />
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-1">
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
            {selectedFolder ? (
              <p className="text-xs text-muted-foreground">
                Selected:{" "}
                <span className="font-medium text-foreground">
                  {selectedFolder.name}
                </span>
              </p>
            ) : null}
          </div>

          <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              Any existing file with the same name in the selected folder will
              be overwritten.
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button disabled={!canSubmit} onClick={() => void handleConfirm()}>
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Exporting...
              </>
            ) : (
              "Export"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
