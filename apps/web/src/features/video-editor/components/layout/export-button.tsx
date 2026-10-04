import { Download, Loader2, X } from "lucide-react"
import { Button } from "@sohizi/ui/button"
import { useVideoExport } from "../../hooks/use-video-export"

export function ExportButton({ fileName }: { fileName: string }) {
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
