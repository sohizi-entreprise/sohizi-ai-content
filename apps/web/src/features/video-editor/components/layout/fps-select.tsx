import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sohizi/ui/select"
import { useVideoEditorStore } from "../../store/editor-store"

const FPS_OPTIONS = [24, 30, 60] as const

const triggerClassName =
  "h-8 w-fit gap-1 rounded-lg border-0 bg-transparent px-2 text-xs font-medium text-foreground shadow-none hover:bg-accent hover:text-foreground focus-visible:ring-0 dark:bg-transparent dark:hover:bg-accent [&_svg]:size-3"

export function FpsSelect() {
  const fps = useVideoEditorStore((s) => s.fps)
  const setFps = useVideoEditorStore((s) => s.setFps)
  const options = FPS_OPTIONS.includes(fps as (typeof FPS_OPTIONS)[number])
    ? FPS_OPTIONS
    : [fps, ...FPS_OPTIONS]

  return (
    <Select
      value={String(fps)}
      onValueChange={(value) => setFps(Number(value))}
    >
      <SelectTrigger
        size="sm"
        title="Frames per second"
        aria-label="Frames per second"
        className={triggerClassName}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {options.map((option) => (
          <SelectItem key={option} value={String(option)} className="text-xs">
            {option} FPS
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
