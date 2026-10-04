import { useEffect, useRef, useState } from "react"
import { Link } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@sohizi/ui/input"
import { OutputControls } from "./output-controls"
import { SaveIndicator } from "./save-indicator"
import {
  listFilesByTypeQueryOptions,
  renameFileNodeMutationOptions,
} from "@/features/projects/query-mutation"

interface EditorTopBarProps {
  projectId: string
  fileNodeId: string
}

export function EditorTopBar({ projectId, fileNodeId }: EditorTopBarProps) {
  const fileName = useCompositionName(projectId, fileNodeId)

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 px-3">
      <Link
        to="/projects/$projectId/video-editor"
        params={{ projectId }}
        className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
      >
        <ArrowLeft className="size-4 shrink-0" />
        All videos projects
      </Link>

      <div className="mx-1 h-5 w-px bg-border" />

      <CompositionTitle projectId={projectId} fileNodeId={fileNodeId} />

      <SaveIndicator />

      <div className="ml-auto">
        <OutputControls fileName={fileName} />
      </div>
    </header>
  )
}

function useCompositionName(projectId: string, fileNodeId: string): string {
  const { data: files } = useQuery(
    listFilesByTypeQueryOptions(projectId, "video-editor"),
  )
  return files?.find((file) => file.id === fileNodeId)?.name ?? ""
}

function CompositionTitle({ projectId, fileNodeId }: EditorTopBarProps) {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState("")

  const filesQueryOptions = listFilesByTypeQueryOptions(
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
