import {
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  Maximize2,
  Repeat,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'

export function PreviewPanel() {
  return (
    <div className="flex h-full flex-col bg-black/40 rounded-lg overflow-hidden border border-border">
      {/* Video area */}
      <div className="relative flex flex-1 items-center justify-center bg-muted/10">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-muted-foreground/40">
            <div className="flex size-16 items-center justify-center rounded-full border-2 border-muted-foreground/20 bg-muted/20 backdrop-blur-sm transition-colors hover:border-primary/50 hover:text-primary/60 cursor-pointer">
              <Play className="ml-1 size-7" />
            </div>
            <span className="text-xs">Preview</span>
          </div>
        </div>
      </div>

      {/* Playback controls */}
      <div className="shrink-0 border-t border-border/50 bg-background/80 px-3 py-2">
        <Slider
          defaultValue={[35]}
          max={100}
          step={1}
          className="mb-2"
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground">
              <SkipBack className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="size-8 text-foreground">
              <Play className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground">
              <SkipForward className="size-3.5" />
            </Button>
            <span className="ml-2 text-[11px] tabular-nums text-muted-foreground">
              00:54 / 01:16
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground">
              <Volume2 className="size-3.5" />
            </Button>
            <span className="text-[11px] text-muted-foreground">1.0x</span>
            <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground">
              <Repeat className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground">
              <Maximize2 className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
