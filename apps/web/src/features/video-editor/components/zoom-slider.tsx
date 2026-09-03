import { ZoomIn, ZoomOut } from "lucide-react"
import { Slider } from "@sohizi/ui/slider"
import { Button } from "@sohizi/ui/button"
import { useVideoEditorStore } from "../store/editor-store"
import { cn } from "@/lib/utils"

const MIN = 0.25
const MAX = 8
const STEP = 0.05

export function ZoomSlider() {
  const zoomScale = useVideoEditorStore((s) => s.zoomScale)
  const setZoomScale = useVideoEditorStore((s) => s.setZoomScale)

  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="ghost"
        size="icon-sm"
        className="size-7"
        onClick={() => setZoomScale(Math.max(MIN, zoomScale - 0.25))}
        title="Zoom out"
      >
        <ZoomOut className="size-3.5 text-muted-foreground" />
      </Button>
      <div
        className={cn(
          "w-32",
          "**:data-[slot=slider-track]:h-1 **:data-[slot=slider-track]:rounded-full **:data-[slot=slider-track]:bg-accent",
          "**:data-[slot=slider-range]:bg-primary",
          "**:data-[slot=slider-thumb]:size-3.5 **:data-[slot=slider-thumb]:border-0! **:data-[slot=slider-thumb]:bg-primary! **:data-[slot=slider-thumb]:shadow-none!",
          "**:data-[slot=slider-thumb]:hover:ring-0! **:data-[slot=slider-thumb]:focus-visible:ring-2 **:data-[slot=slider-thumb]:focus-visible:ring-primary/25",
        )}
      >
        <Slider
          min={MIN}
          max={MAX}
          step={STEP}
          value={[zoomScale]}
          onValueChange={(v) => {
            if (Array.isArray(v) && typeof v[0] === "number") {
              setZoomScale(v[0])
            }
          }}
        />
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        className="size-7"
        onClick={() => setZoomScale(Math.min(MAX, zoomScale + 0.25))}
        title="Zoom in"
      >
        <ZoomIn className="size-3.5 text-muted-foreground" />
      </Button>
    </div>
  )
}
