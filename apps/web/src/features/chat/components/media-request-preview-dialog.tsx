import { useEffect, useMemo, useState } from "react"
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query"
import { AlertCircle, Copy } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@sohizi/ui/badge"
import { Button } from "@sohizi/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@sohizi/ui/dialog"
import { Spinner } from "@sohizi/ui/spinner"
import { useBufferChunks } from "../hooks/use-buffer-chunks"
import type {
  RunMediaRequestAsset,
  RunMediaRequestItem,
  RunMediaRequestStatus,
} from "../lib/extract-run-activity"
import AudioPlayer from "@/features/media-generator/components/audio-player"
import { getGenerationDetails } from "@/features/media-generator/lib/request-state"
import { listAiGeneratedAssetsQueryOptions } from "@/features/media-generator/query-mutations"
import { cn } from "@/lib/utils"
import {
  buildOptimizeddImageUrl,
  imageUrlTransforms,
} from "@/utils/transform-url"

type MediaRequestPreviewDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  item: RunMediaRequestItem | null
}

export function MediaRequestPreviewDialog({
  open,
  onOpenChange,
  projectId,
  item,
}: MediaRequestPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl px-0" showCloseButton={true}>
        {item ? (
          <div className="max-h-[75vh] overflow-y-auto px-4">
            <MediaRequestPreviewBody projectId={projectId} item={item} />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function MediaRequestPreviewBody({
  projectId,
  item,
}: {
  projectId: string
  item: RunMediaRequestItem
}) {
  const queryClient = useQueryClient()
  const { data: aiRequests = [] } = useInfiniteQuery({
    ...listAiGeneratedAssetsQueryOptions(projectId),
    enabled: Boolean(item.jobId),
  })

  const matchedRequest = useMemo(
    () =>
      item.jobId
        ? (aiRequests.find((req) => req.id === item.jobId) ?? null)
        : null,
    [aiRequests, item.jobId],
  )

  const [streamedAssets, setStreamedAssets] = useState<
    Array<RunMediaRequestAsset>
  >([])
  const [streamedStatus, setStreamedStatus] =
    useState<RunMediaRequestStatus | null>(null)
  const [streamedError, setStreamedError] = useState<string | null>(null)

  useEffect(() => {
    setStreamedAssets([])
    setStreamedStatus(null)
    setStreamedError(null)
  }, [item.id])

  const resolvedStatus: RunMediaRequestStatus = useMemo(() => {
    if (streamedStatus) return streamedStatus
    if (matchedRequest) {
      if (matchedRequest.status === "completed") return "completed"
      if (
        matchedRequest.status === "failed" ||
        matchedRequest.status === "aborted"
      ) {
        return "failed"
      }
      if (matchedRequest.status === "processing") return "running"
      return "queued"
    }
    return item.status
  }, [streamedStatus, matchedRequest, item.status])

  const resolvedAssets: Array<RunMediaRequestAsset> = useMemo(() => {
    if (streamedAssets.length > 0) return streamedAssets
    if (matchedRequest && matchedRequest.assets.length > 0) {
      return matchedRequest.assets.map((a) => ({
        id: a.id,
        name: a.name,
        url: a.url,
        type: a.type,
      }))
    }
    return item.assets
  }, [streamedAssets, matchedRequest, item.assets])

  const resolvedError =
    streamedError ?? matchedRequest?.error ?? item.error ?? null

  const isLiveStreaming =
    Boolean(item.jobId) &&
    (resolvedStatus === "queued" || resolvedStatus === "running")

  const syntheticRequest = useMemo<Record<string, unknown>>(
    () =>
      matchedRequest?.request ?? {
        model: item.modelId,
        settings: item.parameters,
        context: {
          generationType: item.kind === "speech" ? "audio" : item.kind,
          mediaType: item.kind === "speech" ? "audio" : item.kind,
        },
      },
    [matchedRequest?.request, item.modelId, item.parameters, item.kind],
  )

  const details = useMemo(
    () =>
      getGenerationDetails(syntheticRequest, {
        credits: matchedRequest?.credits ?? null,
        error: resolvedError,
      }),
    [syntheticRequest, matchedRequest?.credits, resolvedError],
  )

  const copyPrompt = async () => {
    if (!details?.prompt) return
    try {
      await navigator.clipboard.writeText(details.prompt)
      toast.success("Prompt copied")
    } catch {
      toast.error("Failed to copy prompt")
    }
  }

  return (
    <div className="space-y-5">
      {isLiveStreaming && item.jobId ? (
        <LiveMediaRequestStream
          projectId={projectId}
          jobId={item.jobId}
          onAsset={(asset) => {
            setStreamedAssets((prev) =>
              prev.some((a) => a.id === asset.id) ? prev : [...prev, asset],
            )
          }}
          onFinish={(ok, err) => {
            setStreamedStatus(ok ? "completed" : "failed")
            if (err) setStreamedError(err)
            void queryClient.invalidateQueries({
              queryKey: ["media", projectId, "ai-assets"],
            })
          }}
        />
      ) : null}

      <DialogHeader className="gap-1.5">
        <div className="flex flex-wrap items-center gap-2 pr-6">
          <DialogTitle className="text-base font-semibold">
            {item.label}
          </DialogTitle>
          <MediaStatusBadge status={resolvedStatus} />
        </div>
        <DialogDescription className="text-xs text-muted-foreground">
          {item.modelId ? `${item.kind} • ${item.modelId}` : item.kind}
        </DialogDescription>
      </DialogHeader>

      <MediaPreviewStage
        status={resolvedStatus}
        assets={resolvedAssets}
        error={resolvedError}
      />

      {details ? (
        <div className="space-y-4">
          {details.prompt ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                  Prompt
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={copyPrompt}
                  className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Copy className="size-3" />
                  Copy
                </Button>
              </div>
              <p className="rounded-lg border bg-surface/60 p-3 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                {details.prompt}
              </p>
            </div>
          ) : null}

          {details.meta.length > 0 || details.parameters.length > 0 ? (
            <div className="space-y-1.5">
              <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                Parameters
              </span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[...details.meta, ...details.parameters].map((tile) => (
                  <div
                    key={`${tile.label}-${tile.value}`}
                    className="rounded-lg border bg-surface/60 px-3 py-2"
                  >
                    <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                      {tile.label}
                    </p>
                    <p className="mt-0.5 truncate text-xs font-medium text-foreground">
                      {tile.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function LiveMediaRequestStream({
  projectId,
  jobId,
  onAsset,
  onFinish,
}: {
  projectId: string
  jobId: string
  onAsset: (asset: RunMediaRequestAsset) => void
  onFinish: (succeeded: boolean, error?: string | null) => void
}) {
  const [hasAsset, setHasAsset] = useState(false)
  useBufferChunks({
    url: `/api/media/${projectId}/requests/${jobId}`,
    initialMessages: [],
    onAsset: (asset) => {
      setHasAsset(true)
      onAsset({
        id: asset.id,
        name: asset.name,
        url: asset.url,
        type: asset.type,
      })
    },
    onFinish: (status, err) => {
      onFinish(hasAsset || status === "finished", err)
    },
  })
  return null
}

function MediaPreviewStage({
  status,
  assets,
  error,
}: {
  status: RunMediaRequestStatus
  assets: Array<RunMediaRequestAsset>
  error: string | null
}) {
  const [activeIndex, setActiveIndex] = useState(0)

  if (assets.length > 0) {
    const activeAsset = assets[activeIndex] ?? assets[0]
    return (
      <div className="space-y-2">
        <div className="flex max-h-[52vh] min-h-48 items-center justify-center overflow-hidden rounded-xl border bg-black/40 p-3">
          {activeAsset.type === "video" ? (
            <video
              src={activeAsset.url}
              controls
              autoPlay
              playsInline
              className="max-h-[48vh] max-w-full rounded-lg object-contain"
            />
          ) : activeAsset.type === "audio" ? (
            <div className="w-full max-w-xs py-2">
              <AudioPlayer
                src={activeAsset.url}
                title={activeAsset.name}
                className="rounded-xl"
              />
            </div>
          ) : (
            <img
              src={buildOptimizeddImageUrl(
                activeAsset.url,
                imageUrlTransforms.previews.contentCard,
              )}
              alt={activeAsset.name}
              className="max-h-[48vh] max-w-full rounded-lg object-contain"
            />
          )}
        </div>
        {assets.length > 1 ? (
          <div className="flex items-center justify-center gap-1.5">
            {assets.map((asset, index) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={cn(
                  "rounded-md border px-2 py-0.5 text-xs transition-colors",
                  index === activeIndex
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                #{index + 1}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  if (status === "failed") {
    return (
      <div className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-center text-destructive">
        <AlertCircle className="size-5 shrink-0" />
        <p className="text-xs leading-relaxed">
          {error || "Media generation failed"}
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-44 flex-col items-center justify-center gap-2.5 rounded-xl border bg-surface/50 p-6 text-muted-foreground">
      <Spinner className="size-5" />
      <span className="text-xs">Generating media...</span>
    </div>
  )
}

function MediaStatusBadge({ status }: { status: RunMediaRequestStatus }) {
  if (status === "completed") {
    return (
      <Badge
        variant="outline"
        className="border-emerald-500/30 bg-emerald-500/10 text-[11px] text-emerald-400"
      >
        completed
      </Badge>
    )
  }
  if (status === "failed") {
    return (
      <Badge
        variant="outline"
        className="border-destructive/40 bg-destructive/10 text-[11px] text-destructive"
      >
        failed
      </Badge>
    )
  }
  return (
    <Badge
      variant="outline"
      className="border-amber-500/30 bg-amber-500/10 text-[11px] text-amber-300"
    >
      generating
    </Badge>
  )
}
