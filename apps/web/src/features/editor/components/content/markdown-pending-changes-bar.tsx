import { Button } from "@sohizi/ui/button"
import { cn } from "@/lib/utils"

interface MarkdownPendingChangesBarProps {
  changesOpen: boolean
  onToggleChanges: () => void
  onAccept: () => void
  onReject: () => void
  className?: string
}

export function MarkdownPendingChangesBar({
  changesOpen,
  onToggleChanges,
  onAccept,
  onReject,
  className,
}: MarkdownPendingChangesBarProps) {
  return (
    <div
      className={cn(
        "absolute bottom-8 left-1/2 z-10 mt-4 flex w-120 items-center justify-between rounded-xl border border-foreground/60 bg-black/50 py-2 px-2 backdrop-blur-sm -translate-x-1/2",
        className,
      )}
    >
      <h3 className="text-sm font-medium">Pending Operations</h3>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onToggleChanges}
          className="cursor-pointer"
        >
          {changesOpen ? "Hide changes" : "View changes"}
        </Button>
        <Button
          className="rounded-md bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm text-white cursor-pointer"
          onClick={onAccept}
          size="sm"
        >
          Accept
        </Button>
        <Button
          className="rounded-md bg-red-500 hover:bg-red-400 px-4 py-2 text-sm text-white cursor-pointer"
          onClick={onReject}
          size="sm"
        >
          Reject
        </Button>
      </div>
    </div>
  )
}
