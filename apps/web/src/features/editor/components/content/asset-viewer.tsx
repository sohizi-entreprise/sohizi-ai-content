import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Copy, FileCode2, Paperclip } from "lucide-react"
import ReactPlayer from "react-player"
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
import { useEditorStore } from "../../stores/editor-store"
import { DocumentViewer } from "./document-viewer"
import type { AssetContent, AssetType } from "../../types"
import { useChatStore } from "@/features/chat/store/chat-store"
import { getGenerationDetails } from "@/features/media-generator/lib/request-state"
import { getAiGeneratedRequestQueryOptions } from "@/features/media-generator/query-mutations"
import {
  buildOptimizeddImageUrl,
  imageUrlTransforms,
} from "@/utils/transform-url"

type Props = AssetContent & {
  projectId?: string
}

export default function AssetViewer(props: Props) {
  const {
    id,
    assetId,
    type,
    url,
    storageKey,
    metadata,
    source = "user-uploaded",
    generationRequestId,
    projectId,
  } = props
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false)
  const isAiGenerated = source === "ai-generated"

  const handleAttach = () => {
    const { chatOpenByContext, toggleChatPanel } = useEditorStore.getState()
    if (!chatOpenByContext["file-system"]) {
      toggleChatPanel("file-system")
    }

    const optimizedPreview =
      type === "image" ? getOptimizedUrl(type, url, storageKey) : undefined

    useChatStore.getState().addAttachedFile({
      id: assetId ?? id,
      status: "uploaded",
      url,

      type: metadata?.contentType || type,
      ...(optimizedPreview ? { preview: optimizedPreview } : {}),
    })
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border/50 px-3">
        <div className="flex min-w-0 items-center gap-2">
          <Badge
            variant="default"
            className="gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
          >
            {isAiGenerated ? "AI Generated" : "User Uploaded"}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 rounded-full px-3 text-xs font-medium dark:border-border"
            onClick={handleAttach}
          >
            <Paperclip className="size-3.5" />
            Attach
          </Button>

          {isAiGenerated ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 rounded-full px-3 text-xs font-medium dark:border-border"
              onClick={() => setSourceDialogOpen(true)}
            >
              <FileCode2 className="size-3.5" />
              Source
            </Button>
          ) : null}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden">
        <AssetStage
          type={type}
          url={url}
          storageKey={storageKey}
          name={props.name}
        />
      </div>

      {isAiGenerated && projectId ? (
        <AssetSourceDialog
          open={sourceDialogOpen}
          onOpenChange={setSourceDialogOpen}
          projectId={projectId}
          generationRequestId={generationRequestId ?? null}
        />
      ) : null}
    </div>
  )
}

function AssetStage({
  type,
  url,
  storageKey,
  name,
}: {
  type: AssetType
  url: string
  storageKey: string
  name: string
}) {
  switch (type) {
    case "image":
      return (
        <ImageViewer uri={getOptimizedUrl(type, url, storageKey)} name={name} />
      )
    case "document":
      return <DocumentViewer uri={url} />
    case "video":
    case "audio":
      return <VideoAndAudioViewer url={url} />
    default:
      return null
  }
}

function AssetSourceDialog({
  open,
  onOpenChange,
  projectId,
  generationRequestId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  generationRequestId: string | null
}) {
  const { data, isLoading, isError } = useQuery({
    ...getAiGeneratedRequestQueryOptions(projectId, generationRequestId),
    enabled: open && Boolean(projectId && generationRequestId),
  })

  const details = data
    ? getGenerationDetails(data.request, {
        credits: data.credits ?? null,
        error: data.error,
      })
    : null

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl px-0" showCloseButton={true}>
        <DialogHeader className="gap-1.5 px-4">
          <DialogTitle className="text-base font-semibold">
            Generation request
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Prompt and parameters used to generate this asset.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto px-4">
          {!generationRequestId ? (
            <p className="text-sm text-muted-foreground">
              No generation request is linked to this asset.
            </p>
          ) : isLoading ? (
            <div className="flex min-h-36 items-center justify-center gap-2 text-muted-foreground">
              <Spinner className="size-4" />
              <span className="text-xs">Loading generation request...</span>
            </div>
          ) : isError || !data ? (
            <p className="text-sm text-destructive">
              Failed to load generation request details.
            </p>
          ) : details ? (
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

              {details.references.length > 0 ? (
                <div className="space-y-1.5">
                  <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                    References
                  </span>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {details.references.map((reference, index) => (
                      <figure
                        key={`${reference.url}-${index}`}
                        className="space-y-1.5"
                      >
                        <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                          {reference.label}
                        </p>
                        <div className="overflow-hidden rounded-lg border bg-black/40">
                          {reference.type === "video" ? (
                            <video
                              src={reference.url}
                              controls
                              playsInline
                              className="aspect-4/3 w-full object-contain"
                            />
                          ) : (
                            <img
                              src={buildOptimizeddImageUrl(
                                reference.url,
                                imageUrlTransforms.previews.contentCard,
                              )}
                              alt={reference.label}
                              className="aspect-4/3 w-full object-contain"
                            />
                          )}
                        </div>
                      </figure>
                    ))}
                  </div>
                </div>
              ) : null}

              {details.error ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                  {details.error}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No settings were stored for this request.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ImageViewer({ uri, name }: { uri: string; name: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center p-4">
      <img
        src={uri}
        alt={name}
        className="max-h-full max-w-full object-contain"
      />
    </div>
  )
}

function VideoAndAudioViewer({ url }: { url: string }) {
  return (
    <div className="h-full w-full">
      <ReactPlayer src={url} controls width="100%" height="100%" />
    </div>
  )
}

function getOptimizedUrl(type: AssetType, url: string, storageKey: string) {
  if (type === "image") {
    const transformations = imageUrlTransforms.previews.contentCard
    return buildOptimizeddImageUrl(storageKey, transformations)
  }
  return url
}
