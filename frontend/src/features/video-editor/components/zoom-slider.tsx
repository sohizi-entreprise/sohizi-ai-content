import { ZoomIn, ZoomOut } from 'lucide-react'
import { useVideoEditorStore } from '../store/editor-store'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'

const MIN = 0.25
const MAX = 4
const STEP = 0.05

export function ZoomSlider() {
  const zoomScale = useVideoEditorStore((s) => s.zoomScale)
  const setZoomScale = useVideoEditorStore((s) => s.setZoomScale)

  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="ghost"
        size="icon-sm"
        className="size-6"
        onClick={() => setZoomScale(Math.max(MIN, zoomScale - 0.25))}
        title="Zoom out"
      >
        <ZoomOut className="size-3.5" />
      </Button>
      <div className="w-28">
        <Slider
          min={MIN}
          max={MAX}
          step={STEP}
          value={[zoomScale]}
          onValueChange={(v) => {
            if (Array.isArray(v) && typeof v[0] === 'number') {
              setZoomScale(v[0])
            }
          }}
        />
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        className="size-6"
        onClick={() => setZoomScale(Math.min(MAX, zoomScale + 0.25))}
        title="Zoom in"
      >
        <ZoomIn className="size-3.5" />
      </Button>
    </div>
  )
}
