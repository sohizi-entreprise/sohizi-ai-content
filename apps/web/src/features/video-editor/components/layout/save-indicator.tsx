import { Check, Cloud, Loader2 } from "lucide-react"
import { useVideoEditorUiStore } from "../../store/ui-store"

export function SaveIndicator() {
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
