import { useEffect, useMemo, useRef, useState } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"
import { useShallow } from "zustand/shallow"
import {
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  Music,
  Sparkles,
  Video,
} from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@sohizi/ui/collapsible"
import { Spinner } from "@sohizi/ui/spinner"
import { listAgentRunsInfiniteQueryOptions } from "../query-mutation"
import { useChatStore } from "../store/chat-store"
import { extractRunActivity } from "../lib/extract-run-activity"
import { MediaRequestPreviewDialog } from "./media-request-preview-dialog"
import type {
  RunFileActivityItem,
  RunMediaRequestItem,
  RunMediaRequestStatus,
} from "../lib/extract-run-activity"
import {
  getDirectoryIcon,
  getFileIcon,
} from "@/features/editor/utils/get-file-icon"
import { useEditorStore } from "@/features/editor/stores/editor-store"
import { listAiGeneratedAssetsQueryOptions } from "@/features/media-generator/query-mutations"
import { cn } from "@/lib/utils"

export function ChatRunActivityDock({ projectId }: { projectId: string }) {
  const conversation = useChatStore(
    useShallow((state) => state.activeConversation),
  )

  if (
    !conversation ||
    conversation.isNew ||
    conversation.projectId !== projectId
  ) {
    return null
  }

  return (
    <ChatRunActivityDockInner
      key={conversation.id}
      projectId={projectId}
      conversationId={conversation.id}
      isConversationStreaming={Boolean(conversation.isStreaming)}
    />
  )
}

function ChatRunActivityDockInner({
  projectId,
  conversationId,
  isConversationStreaming,
}: {
  projectId: string
  conversationId: string
  isConversationStreaming: boolean
}) {
  const { data: runs = [] } = useInfiniteQuery(
    listAgentRunsInfiniteQueryOptions(projectId, conversationId, false),
  )
  const liveRunMessages = useChatStore((state) => state.liveRunMessages)

  const latestRun = runs.length > 0 ? runs[runs.length - 1] : null
  const isRunStreaming =
    isConversationStreaming ||
    latestRun?.status === "pending" ||
    latestRun?.status === "running"

  const latestMessages = useMemo(() => {
    if (!latestRun) return []
    if (liveRunMessages && liveRunMessages.runId === latestRun.id) {
      return liveRunMessages.messages
    }
    return latestRun.messages
  }, [latestRun, liveRunMessages])

  const activity = useMemo(() => {
    if (!latestRun) return null
    const summary = extractRunActivity(latestRun.id, latestMessages)
    if (summary.files.length === 0 && summary.mediaRequests.length === 0) {
      return null
    }
    return summary
  }, [latestRun, latestMessages])

  const hasMediaRequests = (activity?.mediaRequests.length ?? 0) > 0
  const { data: aiRequests = [] } = useInfiniteQuery({
    ...listAiGeneratedAssetsQueryOptions(projectId),
    enabled: hasMediaRequests,
  })

  const [isOpen, setIsOpen] = useState(false)
  const wasStreamingRef = useRef(isRunStreaming)
  const [selectedMediaRequest, setSelectedMediaRequest] =
    useState<RunMediaRequestItem | null>(null)

  useEffect(() => {
    if (isRunStreaming) {
      wasStreamingRef.current = true
      setIsOpen(false)
      return
    }

    if (wasStreamingRef.current) {
      wasStreamingRef.current = false
      setIsOpen(true)
    }
  }, [isRunStreaming])

  if (!activity) {
    return null
  }

  const { files, mediaRequests } = activity
  const headerLabel = formatActivitySummaryLabel(
    files.length,
    mediaRequests.length,
  )

  return (
    <>
      <div className="mx-1.5 -mb-3 rounded-t-xl border border-b-0 border-white/10 bg-surface/65 px-3 pt-2 pb-4 backdrop-blur-sm">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <div className="flex items-center justify-between gap-2">
            <CollapsibleTrigger
              type="button"
              className="group inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {isOpen ? (
                <ChevronDown className="size-3.5 shrink-0" />
              ) : (
                <ChevronRight className="size-3.5 shrink-0" />
              )}
              <span>{headerLabel}</span>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent className="pt-2 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
            <div className="max-h-44 space-y-0.5 overflow-y-auto pr-1">
              {files.map((file) => (
                <FileActivityRow key={file.id} item={file} />
              ))}
              {mediaRequests.map((req) => {
                const cachedReq = req.jobId
                  ? aiRequests.find((r) => r.id === req.jobId)
                  : undefined
                const status: RunMediaRequestStatus = cachedReq
                  ? cachedReq.status === "completed"
                    ? "completed"
                    : cachedReq.status === "failed" ||
                        cachedReq.status === "aborted"
                      ? "failed"
                      : cachedReq.status === "processing"
                        ? "running"
                        : "queued"
                  : req.status

                return (
                  <MediaRequestActivityRow
                    key={req.id}
                    item={req}
                    status={status}
                    onSelect={() => setSelectedMediaRequest(req)}
                  />
                )
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <MediaRequestPreviewDialog
        open={selectedMediaRequest !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedMediaRequest(null)
        }}
        projectId={projectId}
        item={selectedMediaRequest}
      />
    </>
  )
}

function formatActivitySummaryLabel(
  fileCount: number,
  mediaCount: number,
): string {
  const parts: Array<string> = []
  if (fileCount > 0) {
    parts.push(`${fileCount} ${fileCount === 1 ? "File" : "Files"}`)
  }
  if (mediaCount > 0) {
    parts.push(
      `${mediaCount} ${mediaCount === 1 ? "Media Request" : "Media Requests"}`,
    )
  }
  return parts.join(", ")
}

function FileActivityRow({ item }: { item: RunFileActivityItem }) {
  const icon = item.isDirectory
    ? getDirectoryIcon(false, true, item.name)
    : getFileIcon(item.fileType, item.format, item.name)

  const tagElement = (
    <span
      className={cn(
        "shrink-0 rounded px-1.5 py-0.5 text-[11px] leading-none font-medium",
        item.tag === "created"
          ? "bg-emerald-500/15 text-emerald-400"
          : "bg-sky-500/15 text-sky-400",
      )}
    >
      {item.tag}
    </span>
  )

  if (item.isDirectory) {
    return (
      <div className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm text-muted-foreground select-none">
        {icon}
        <span className="truncate text-foreground/85">{item.name}</span>
        {tagElement}
      </div>
    )
  }

  const handleOpenFile = () => {
    const store = useEditorStore.getState()
    if (item.fileId) {
      void store.openFileById(item.fileId, { ignoreDirectory: true })
      return
    }
    if (item.path) {
      void store.openFileByPath(item.path, { ignoreDirectory: true })
    }
  }

  return (
    <button
      type="button"
      onClick={handleOpenFile}
      className="flex w-full cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm transition-colors hover:bg-white/5"
    >
      {icon}
      <span className="truncate text-foreground/90">{item.name}</span>
      {tagElement}
    </button>
  )
}

function MediaRequestActivityRow({
  item,
  status,
  onSelect,
}: {
  item: RunMediaRequestItem
  status: RunMediaRequestStatus
  onSelect: () => void
}) {
  const isGenerating = status === "queued" || status === "running"

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm transition-colors hover:bg-white/5"
    >
      {isGenerating ? (
        <Spinner className="size-4 shrink-0 text-amber-300" />
      ) : (
        <MediaKindIcon kind={item.kind} />
      )}
      <span className="truncate text-foreground/90">{item.label}</span>
      <span
        className={cn(
          "shrink-0 rounded px-1.5 py-0.5 text-[11px] leading-none font-medium",
          status === "completed"
            ? "bg-emerald-500/15 text-emerald-400"
            : status === "failed"
              ? "bg-destructive/15 text-destructive"
              : "bg-amber-500/15 text-amber-300",
        )}
      >
        {status === "completed"
          ? "created"
          : status === "failed"
            ? "failed"
            : "generating"}
      </span>
    </button>
  )
}

function MediaKindIcon({ kind }: { kind: RunMediaRequestItem["kind"] }) {
  switch (kind) {
    case "image":
      return <ImageIcon className="size-4 shrink-0 text-purple-400" />
    case "video":
      return <Video className="size-4 shrink-0 text-pink-400" />
    case "audio":
    case "speech":
      return <Music className="size-4 shrink-0 text-amber-400" />
    default:
      return <Sparkles className="size-4 shrink-0 text-purple-400" />
  }
}
