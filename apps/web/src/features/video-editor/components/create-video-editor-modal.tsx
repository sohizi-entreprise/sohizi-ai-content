import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { Folder, Loader2 } from "lucide-react"
import { toast } from "sonner"
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
import {
  createFileNodeMutationOptions,
  fileTreeKey,
  filesByFormatKey,
} from "@/features/projects/query-mutation"
import { listFileTreePerDirectory } from "@/features/projects/request"
import { useFolderSearch } from "@/hooks/use-folder-search"
import { cn } from "@/lib/utils"

type CreateVideoEditorModalProps = {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateVideoEditorModal({
  projectId,
  open,
  onOpenChange,
}: CreateVideoEditorModalProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [name, setName] = useState("")
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
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
    setName("")
    setFolderQuery("")
    setSelectedFolderId(null)
    setIsSubmitting(false)
  }, [open, setFolderQuery])

  const selectedFolder = folderOptions.find(
    (folder) => folder.id === selectedFolderId,
  )

  const createMutation = useMutation(createFileNodeMutationOptions(projectId))

  const canSubmit = trimmedName.length > 0 && !!selectedFolder && !isSubmitting

  const handleCreate = async () => {
    if (!selectedFolder || !trimmedName) return

    setIsSubmitting(true)
    try {
      const siblings = await listFileTreePerDirectory(
        projectId,
        selectedFolder.id,
      )
      const position = (siblings.length + 1) * 1000
      const created = await createMutation.mutateAsync({
        name: trimmedName,
        directory: false,
        parentId: selectedFolder.id,
        position,
        format: "video-editor",
      })

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: filesByFormatKey(projectId, "video-editor"),
        }),
        queryClient.invalidateQueries({
          queryKey: fileTreeKey(projectId, selectedFolder.id),
        }),
      ])

      onOpenChange(false)
      void navigate({
        to: "/dashboard/projects/$projectId/video-editor/$fileNodeId",
        params: { projectId, fileNodeId: created.id },
      })
    } catch (error) {
      console.error(error)
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to create video editor",
      )
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New video editor</DialogTitle>
          <DialogDescription>
            Choose a name and a folder where this video editor file should live.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="video-editor-name">Name</Label>
            <Input
              id="video-editor-name"
              value={name}
              maxLength={50}
              onChange={(event) => setName(event.target.value)}
              placeholder="My video"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="video-editor-folder">Folder</Label>
            <Input
              id="video-editor-folder"
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
            {selectedFolder ? (
              <p className="text-xs text-muted-foreground">
                Selected:{" "}
                <span className="font-medium text-foreground">
                  {selectedFolder.name}
                </span>
              </p>
            ) : null}
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
          <Button disabled={!canSubmit} onClick={handleCreate}>
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
