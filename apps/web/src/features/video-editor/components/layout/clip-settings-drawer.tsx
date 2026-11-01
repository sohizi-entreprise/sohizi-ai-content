import { useEffect, useState } from "react"
import { Paperclip, X } from "lucide-react"
import { Button } from "@sohizi/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@sohizi/ui/tooltip"
import { useVideoEditorStore } from "../../store/editor-store"
import { useSelectedClip } from "../../hooks/use-selected-clip"
import { CLIP_TYPE_LABEL, ClipSettings } from "../settings/settings-panel"
import type { ReactNode, TransitionEvent } from "react"
import type { Clip } from "../../store/types"
import { attachFileToChat } from "@/features/editor/bridge/attach-file-to-chat"

interface EditorFile {
  name: string
  path: string
}

const OPEN_COLUMNS = "calc(18rem + 0.5rem) minmax(0, 1fr)"
const CLOSED_COLUMNS = "0rem minmax(0, 1fr)"

export function ClipSettingsDrawer({
  stage,
  file,
}: {
  stage: ReactNode
  file: EditorFile
}) {
  const selectedClip = useSelectedClip()
  const clearSelection = useVideoEditorStore((s) => s.clearSelection)
  const [renderedClip, setRenderedClip] = useState<Clip | null>(selectedClip)
  const open = selectedClip !== null
  const clip = selectedClip ?? renderedClip

  useEffect(() => {
    if (selectedClip) setRenderedClip(selectedClip)
  }, [selectedClip])

  const handleTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    if (event.propertyName !== "grid-template-columns") return
    if (!open) setRenderedClip(null)
  }

  return (
    <div
      className="grid h-full min-h-0 transition-[grid-template-columns] duration-300 ease-out"
      style={{ gridTemplateColumns: open ? OPEN_COLUMNS : CLOSED_COLUMNS }}
      onTransitionEnd={handleTransitionEnd}
    >
      <div className="min-h-0 min-w-0 overflow-hidden">
        {clip ? (
          <div className="flex h-full w-[calc(18rem+0.5rem)] pr-2">
            <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-card ring-1 ring-border/50">
              <ClipSettingsHeader
                clip={clip}
                file={file}
                onClose={clearSelection}
              />
              <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3.5">
                <ClipSettings clip={clip} />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="min-h-0 min-w-0">{stage}</div>
    </div>
  )
}

function ClipSettingsHeader({
  clip,
  file,
  onClose,
}: {
  clip: Clip
  file: EditorFile
  onClose: () => void
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-3.5 py-3">
      <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-sm font-medium text-foreground">
          {CLIP_TYPE_LABEL[clip.type]}
        </h2>
      </div>
      <AttachClipButton file={file} clipId={clip.id} />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="size-7 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
        onClick={onClose}
        aria-label="Close clip settings"
      >
        <X className="size-4" />
      </Button>
    </div>
  )
}

function AttachClipButton({
  file,
  clipId,
}: {
  file: EditorFile
  clipId: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-7 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
          aria-label="Attach as a context"
          onClick={() =>
            attachFileToChat({
              file,
              extraText: `[clip:${clipId}]`,
            })
          }
        >
          <Paperclip className="size-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Attach as a context</TooltipContent>
    </Tooltip>
  )
}
