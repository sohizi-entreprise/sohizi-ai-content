import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Upload } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@sohizi/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@sohizi/ui/tabs"
import { appendDirectoryChild } from "../../stores/directory-children-cache"
import type { ReactNode } from "react"
import type { DirectoryChild } from "@/features/projects/type"
import type { FileUploadActions } from "@/hooks/use-file-upload"
import {
  directoryChildrenKey,
  fileTreeKey,
  getlistFileTreePerDirectoryOptions,
} from "@/features/projects/query-mutation"
import { useFileUpload } from "@/hooks/use-file-upload"
import { useSaveFileBucket } from "@/hooks/use-save-file-bucket"
import { cn } from "@/lib/utils"

const ASSET_ACCEPT = "image/*,video/*,audio/*,text/plain,.docx"
const MAX_CHILDREN_PER_DIRECTORY = 100

type CreatedAssetHandler = (parentId: string, node: DirectoryChild) => void

type NewAssetDialogContextValue = {
  openNewAsset: (folderId: string) => Promise<void>
  registerOnAssetCreated: (handler: CreatedAssetHandler) => () => void
}

const NewAssetDialogContext = createContext<NewAssetDialogContextValue | null>(
  null,
)

export function useNewAssetDialog() {
  const value = useContext(NewAssetDialogContext)
  if (!value) {
    throw new Error("New asset dialog is unavailable")
  }
  return value
}

type NewAssetDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  isDragging: boolean
  openFileDialog: FileUploadActions["openFileDialog"]
  getInputProps: FileUploadActions["getInputProps"]
  handleDragEnter: FileUploadActions["handleDragEnter"]
  handleDragLeave: FileUploadActions["handleDragLeave"]
  handleDragOver: FileUploadActions["handleDragOver"]
  handleDrop: FileUploadActions["handleDrop"]
}

export function NewAssetDialog({
  open,
  onOpenChange,
  isDragging,
  openFileDialog,
  getInputProps,
  handleDragEnter,
  handleDragLeave,
  handleDragOver,
  handleDrop,
}: NewAssetDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New asset</DialogTitle>
          <DialogDescription>Add a file from your computer.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="local">
          <TabsList>
            <TabsTrigger value="local">From local computer</TabsTrigger>
          </TabsList>
          <TabsContent value="local">
            <button
              type="button"
              onClick={openFileDialog}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className={cn(
                "flex min-h-64 w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-6 text-center text-sm text-muted-foreground transition-colors hover:bg-muted/50",
                isDragging && "border-primary bg-primary/5 text-foreground",
              )}
            >
              <Upload className="size-8" />
              <span>Drop a file here, or click to browse</span>
            </button>
            <input {...getInputProps()} className="sr-only" />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

export function NewAssetDialogProvider({
  projectId,
  children,
}: {
  projectId: string
  children: ReactNode
}) {
  const queryClient = useQueryClient()
  const { saveFile } = useSaveFileBucket()
  const [open, setOpen] = useState(false)
  const folderIdRef = useRef<string | null>(null)
  const onCreatedRef = useRef<CreatedAssetHandler | null>(null)

  const [{ isDragging }, upload] = useFileUpload({
    multiple: false,
    accept: ASSET_ACCEPT,
    onFilesAdded: (added) => {
      const targetId = folderIdRef.current
      if (!targetId) return
      setOpen(false)

      for (const file of added) {
        if (!(file.file instanceof File)) continue
        const selected = file.file
        const toastId = toast.loading(`Uploading ${selected.name}…`)
        void saveFile(
          { projectId, folderId: targetId, file: selected },
          {
            onSuccess: (result) => {
              if (!result.fileNode) {
                toast.error(`Couldn't upload ${selected.name}`, { id: toastId })
                return
              }
              const previewUrl =
                result.fileNode.type === "image" ||
                result.fileNode.type === "video"
                  ? result.asset.url
                  : null
              const child: DirectoryChild = {
                ...result.fileNode,
                previewUrl,
              }
              appendDirectoryChild(queryClient, projectId, targetId, child)
              void queryClient.invalidateQueries({
                queryKey: directoryChildrenKey(projectId, targetId),
              })
              void queryClient.invalidateQueries({
                queryKey: fileTreeKey(projectId, targetId),
                refetchType: "all",
              })
              onCreatedRef.current?.(targetId, child)
              toast.success(`Uploaded ${selected.name}`, { id: toastId })
            },
            onError: (error) => {
              toast.error(error.message, { id: toastId })
            },
          },
        ).catch(() => {
          // The error toast is shown in onError. saveFile rethrows after that.
        })
      }
    },
    onError: (error) => {
      toast.error(error)
    },
  })

  const { clearFiles } = upload
  const openNewAsset = useCallback(
    async (folderId: string) => {
      try {
        const folderChildren = await queryClient.ensureQueryData(
          getlistFileTreePerDirectoryOptions(projectId, folderId),
        )
        if (folderChildren.length >= MAX_CHILDREN_PER_DIRECTORY) {
          toast.error("Maximum number of children reached")
          return
        }
        folderIdRef.current = folderId
        clearFiles()
        setOpen(true)
      } catch (error) {
        console.error("Failed to check folder before creating an asset:", error)
        toast.error("Couldn't open new asset")
      }
    },
    [clearFiles, projectId, queryClient],
  )

  const registerOnAssetCreated = useCallback((handler: CreatedAssetHandler) => {
    onCreatedRef.current = handler
    return () => {
      if (onCreatedRef.current === handler) onCreatedRef.current = null
    }
  }, [])

  const value = useMemo(
    () => ({ openNewAsset, registerOnAssetCreated }),
    [openNewAsset, registerOnAssetCreated],
  )

  return (
    <NewAssetDialogContext.Provider value={value}>
      {children}
      <NewAssetDialog
        open={open}
        onOpenChange={setOpen}
        isDragging={isDragging}
        openFileDialog={upload.openFileDialog}
        getInputProps={upload.getInputProps}
        handleDragEnter={upload.handleDragEnter}
        handleDragLeave={upload.handleDragLeave}
        handleDragOver={upload.handleDragOver}
        handleDrop={upload.handleDrop}
      />
    </NewAssetDialogContext.Provider>
  )
}
