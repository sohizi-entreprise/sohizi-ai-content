import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
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
import { useSelectedClip } from "../../hooks/use-selected-clip"
import { generateCaptionMutationOptions } from "../../query-mutations"

interface CaptionScopeDialogProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CaptionScopeDialog({
  projectId,
  open,
  onOpenChange,
}: CaptionScopeDialogProps) {
  const selectedClip = useSelectedClip()
  const [pendingScope, setPendingScope] = useState<"clip" | "track" | null>(
    null,
  )
  const { mutate, isPending } = useMutation(
    generateCaptionMutationOptions(projectId),
  )

  const generate = (scope: "clip" | "track") => {
    if (!selectedClip) return
    setPendingScope(scope)
    mutate(
      {
        trackId: selectedClip.trackId,
        clipId: scope === "clip" ? selectedClip.id : undefined,
      },
      {
        onSuccess: () => {
          toast.success("Captions generated. Reopen this video to load them.")
          onOpenChange(false)
        },
        onError: (error) => {
          toast.error(error.message)
        },
        onSettled: () => setPendingScope(null),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={!isPending}>
        <DialogHeader>
          <DialogTitle>Generate captions</DialogTitle>
          <DialogDescription>
            Transcribe the selected clip, or every video and audio clip on its
            track.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            className="gap-1.5"
            disabled={!selectedClip || isPending}
            onClick={() => generate("clip")}
          >
            {pendingScope === "clip" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : null}
            Selected clip
          </Button>
          <Button
            type="button"
            className="gap-1.5"
            disabled={!selectedClip || isPending}
            onClick={() => generate("track")}
          >
            {pendingScope === "track" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : null}
            Entire track
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
