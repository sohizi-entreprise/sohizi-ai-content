import {
  CircleCheck,
  Clock,
  Loader2,
  Redo2,
  TriangleAlert,
  Undo2,
} from "lucide-react"
import { useEditorState } from "@tiptap/react"
import { MAX_CHARACTER_COUNT } from "../../constants"
import { useEditorStore } from "../../stores/editor-store"
import type { Editor } from "@tiptap/core"
import { Button } from "@sohizi/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@sohizi/ui/tooltip"
import { cn, timeFromNow } from "@/lib/utils"

export function EditorTopChrome({
  editor,
  tabId,
}: {
  editor: Editor
  tabId: string
}) {
  const savingStatus = useEditorStore((s) => s.savingStatus[tabId])
  const lastSavedAt = useEditorStore((s) => s.lastSavedAt[tabId])

  const { canUndo, canRedo, characters } = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      canUndo: currentEditor.can().undo(),
      canRedo: currentEditor.can().redo(),
      characters: currentEditor.storage.characterCount.characters(),
    }),
  })

  const remaining = Math.max(0, MAX_CHARACTER_COUNT - characters)
  const consumedPercent = Math.min(
    100,
    (characters / MAX_CHARACTER_COUNT) * 100,
  )
  const remainingPercent = Math.max(0, Math.round(100 - consumedPercent))

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-10 items-center justify-between px-3 backdrop-blur-sm">
      <div className="pointer-events-auto flex items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Undo"
          disabled={!canUndo}
          onMouseDown={(event) => {
            event.preventDefault()
            editor.chain().focus().undo().run()
          }}
          className="size-7 text-foreground hover:text-foreground"
        >
          <Undo2 className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Redo"
          disabled={!canRedo}
          onMouseDown={(event) => {
            event.preventDefault()
            editor.chain().focus().redo().run()
          }}
          className="size-7 text-foreground hover:text-foreground"
        >
          <Redo2 className="size-4" />
        </Button>
      </div>

      <div className="pointer-events-auto flex items-center gap-2.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
              aria-label={`${remaining.toLocaleString()} characters remaining`}
            >
              <CharacterUsageDonut percentage={consumedPercent} />
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            className="max-w-56 text-left"
          >
            This document allows up to {MAX_CHARACTER_COUNT.toLocaleString()}{" "}
            characters. {remainingPercent}% of the limit remaining.
          </TooltipContent>
        </Tooltip>

        <SaveStatusIndicator
          status={savingStatus}
          updatedAt={lastSavedAt}
        />
      </div>
    </div>
  )
}

function CharacterUsageDonut({ percentage }: { percentage: number }) {
  const diameter = 14
  const strokeWidth = 2
  const radius = (diameter - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset =
    circumference -
    (Math.min(100, Math.max(0, percentage)) / 100) * circumference

  const strokeColor =
    percentage >= 90
      ? "stroke-red-500/60"
      : percentage >= 70
        ? "stroke-amber-500/60"
        : "stroke-muted-foreground/70"

  return (
    <svg
      width={diameter}
      height={diameter}
      viewBox={`0 0 ${diameter} ${diameter}`}
      className="-rotate-90"
      aria-hidden
    >
      <circle
        cx={diameter / 2}
        cy={diameter / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        className="stroke-muted-foreground/45"
      />
      <circle
        cx={diameter / 2}
        cy={diameter / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        className={cn("transition-all duration-300", strokeColor)}
      />
    </svg>
  )
}

function SaveStatusIndicator({
  status,
  updatedAt,
}: {
  status: "saving" | "saved" | "error" | undefined
  updatedAt?: string
}) {
  if (status === "saving") {
    return (
      <span
        className="flex size-7 items-center justify-center text-muted-foreground"
        aria-label="Saving"
      >
        <Loader2 className="size-3.5 animate-spin" />
      </span>
    )
  }

  const isError = status === "error"
  const tooltip = isError
    ? "Couldn't save the document. Try again."
    : updatedAt
      ? `Updated ${timeFromNow(updatedAt)}`
      : "Not saved yet"

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex size-7 items-center justify-center rounded-md transition-colors",
            isError
              ? "text-amber-500/80 hover:text-amber-500"
              : "text-muted-foreground hover:text-foreground",
          )}
          aria-label={isError ? "Save error" : "Save status"}
        >
          {status === "saved" ? (
            <CircleCheck className="size-3.5" />
          ) : isError ? (
            <TriangleAlert className="size-3.5" />
          ) : (
            <Clock className="size-3.5" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{tooltip}</TooltipContent>
    </Tooltip>
  )
}
