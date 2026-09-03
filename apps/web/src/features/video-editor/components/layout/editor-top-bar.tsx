import { useEffect, useRef, useState } from "react"
import { Link } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Check, Cloud, Download, Loader2, X } from "lucide-react"
import { toast } from "sonner"
import { useVideoEditorUiStore } from "../../store/ui-store"
import { useVideoExport } from "../../hooks/use-video-export"
import {
  listFilesByFormatQueryOptions,
  renameFileNodeMutationOptions,
} from "@/features/projects/query-mutation"
import { Button } from "@sohizi/ui/button"
import { Input } from "@sohizi/ui/input"

interface EditorTopBarProps {
  projectId: string
  fileNodeId: string
}

export function EditorTopBar({ projectId, fileNodeId }: EditorTopBarProps) {
  const fileName = useCompositionName(projectId, fileNodeId)

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 px-3">
      <Link
        to="/dashboard/projects/$projectId/video-editor"
        params={{ projectId }}
        className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
      >
        <ArrowLeft className="size-4 shrink-0" />
        All videos projects
      </Link>

      <div className="mx-1 h-5 w-px bg-border" />

      <CompositionTitle
        projectId={projectId}
        fileNodeId={fileNodeId}
      />

      <SaveIndicator />

      <div className="ml-auto flex items-center gap-1">
        <ExportButton fileName={fileName} />
      </div>
    </header>
  )
}

function useCompositionName(projectId: string, fileNodeId: string): string {
  const { data: files } = useQuery(
    listFilesByFormatQueryOptions(projectId, "video-editor"),
  )
  return files?.find((file) => file.id === fileNodeId)?.name ?? ""
}

function ExportButton({ fileName }: { fileName: string }) {
  const {
    job,
    isSubmitting,
    isCancelling,
    isDownloading,
    isBusy,
    canExport,
    start,
    cancel,
    download,
  } = useVideoExport()

  if (job?.status === "completed") {
    return (
      <Button
        size="sm"
        variant="secondary"
        disabled={isDownloading}
        className="h-8 gap-1.5 rounded-lg px-3 text-xs font-semibold"
        onClick={() => void download()}
      >
        {isDownloading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Download className="size-3.5" />
        )}
        Download
      </Button>
    )
  }

  if (isBusy) {
    return (
      <div className="flex items-center gap-1">
        <span className="flex h-8 items-center gap-1.5 rounded-lg bg-muted/60 px-3 text-xs font-medium text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          {job?.status === "rendering"
            ? `Rendering ${job.progress}%`
            : "Queued"}
        </span>
        <Button
          size="icon"
          variant="ghost"
          disabled={isCancelling || isSubmitting}
          className="size-8 rounded-lg text-muted-foreground"
          title="Cancel export"
          onClick={() => void cancel()}
        >
          <X className="size-3.5" />
        </Button>
      </div>
    )
  }

  return (
    <Button
      size="sm"
      disabled={!canExport}
      className="h-8 gap-1.5 rounded-lg px-3 text-xs font-semibold"
      onClick={() => void start(fileName)}
    >
      <Download className="size-3.5" />
      {job?.status === "failed" ? "Retry export" : "Export"}
    </Button>
  )
}

function CompositionTitle({ projectId, fileNodeId }: EditorTopBarProps) {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState("")

  const filesQueryOptions = listFilesByFormatQueryOptions(
    projectId,
    "video-editor",
  )
  const { data: files } = useQuery(filesQueryOptions)
  const name = files?.find((file) => file.id === fileNodeId)?.name ?? ""

  const { mutateAsync: rename, isPending } = useMutation(
    renameFileNodeMutationOptions(projectId),
  )

  useEffect(() => {
    if (isEditing) inputRef.current?.select()
  }, [isEditing])

  const startEditing = () => {
    setDraft(name)
    setIsEditing(true)
  }

  const commit = async () => {
    const next = draft.trim()
    setIsEditing(false)
    if (!next || next === name) return
    try {
      await rename({ fileId: fileNodeId, name: next })
      await queryClient.invalidateQueries({
        queryKey: filesQueryOptions.queryKey,
      })
    } catch {
      toast.error("Could not rename this video")
    }
  }

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") void commit()
          if (e.key === "Escape") setIsEditing(false)
        }}
        autoFocus
        className="h-8 w-56 rounded-lg bg-muted/50 text-sm font-medium"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      disabled={isPending || !name}
      className="max-w-64 truncate rounded-lg px-2 py-1 text-sm font-medium text-foreground hover:bg-muted/60"
      title="Rename"
    >
      {name || "Untitled video"}
    </button>
  )
}

function SaveIndicator() {
  const saveStatus = useVideoEditorUiStore((s) => s.saveStatus)

  if (saveStatus === "idle") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Cloud className="size-3.5" />
        Autosave on
      </span>
    )
  }

  if (saveStatus === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Saving
      </span>
    )
  }

  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Check className="size-3.5 text-primary" />
      Saved
    </span>
  )
}
