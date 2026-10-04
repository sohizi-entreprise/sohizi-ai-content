import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sohizi/ui/select"
import { X } from "lucide-react"
import { useVideoEditorUiStore } from "../../store/ui-store"

const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0] as const

function formatRate(rate: number): string {
  return Number.isInteger(rate) ? rate.toFixed(1) : String(rate)
}

export function PlaybackSpeedPicker() {
  const playbackRate = useVideoEditorUiStore((s) => s.playbackRate)
  const setPlaybackRate = useVideoEditorUiStore((s) => s.setPlaybackRate)

  return (
    <Select
      value={String(playbackRate)}
      onValueChange={(value) => setPlaybackRate(Number(value))}
    >
      <SelectTrigger
        size="sm"
        title="Playback speed"
        aria-label="Playback speed"
        className="font-mono h-8 w-fit gap-1 rounded-lg border-0 bg-transparent px-2 text-xs font-medium text-foreground shadow-none hover:bg-accent hover:text-foreground focus-visible:ring-0 dark:bg-transparent dark:hover:bg-accent [&_svg]:size-3"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent side="top" align="start">
        {PLAYBACK_RATES.map((rate) => (
          <SelectItem key={rate} value={String(rate)} className="text-xs">
            <span className="inline-flex items-center gap-0.5">
              {formatRate(rate)}
              <X className="size-3 text-foreground" aria-hidden />
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
