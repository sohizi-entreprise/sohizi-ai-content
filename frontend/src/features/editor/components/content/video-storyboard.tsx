import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Plus, ChevronDown, Grid2X2, List } from 'lucide-react'
import type { EditorTab } from '../../types'

interface VideoStoryboardProps {
  tab: EditorTab
}

function ShotsGrid() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="size-6 text-muted-foreground">
            <Grid2X2 className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="size-6 text-muted-foreground">
            <List className="size-3.5" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">Sound Effects</span>
          <ChevronDown className="size-3 text-muted-foreground" />
        </div>
        <Button variant="ghost" size="sm" className="h-6 text-[11px] text-primary gap-1">
          <Plus className="size-3" />
          Add Shot
        </Button>
      </div>
      <ScrollArea className="flex-1">
        {/* <div className="p-3 space-y-4">
          {MOCK_SCENES.map((scene) => (
            <div key={scene.id}>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">
                  Scene {scene.number}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {scene.heading}
                </span>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {scene.shots.map((shot) => (
                  <ShotCard
                    key={shot.id}
                    shot={shot}
                  />
                ))}
              </div>
            </div>
          ))}
        </div> */}
      </ScrollArea>
    </div>
  )
}

export function VideoStoryboard(_props: VideoStoryboardProps) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      <ResizablePanelGroup direction="vertical" className="h-full w-full">
        {/* Top: Scene panel + shots + preview */}
        <ResizablePanel defaultSize={65} minSize={40}>
          <ResizablePanelGroup direction="horizontal" className="h-full w-full">
            {/* Left: Scene metadata */}
            <ResizablePanel defaultSize={22} minSize={18} maxSize={35}>
           
            </ResizablePanel>
            <ResizableHandle />

            {/* Center: Shot cards */}
            <ResizablePanel defaultSize={50} minSize={30}>
              <ShotsGrid />
            </ResizablePanel>
            <ResizableHandle />

            {/* Right: Preview */}
            <ResizablePanel defaultSize={28} minSize={20}>
              <div className="h-full p-2">
               
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
        <ResizableHandle />

        {/* Bottom: Timeline */}
        <ResizablePanel defaultSize={35} minSize={15} maxSize={50}>
       
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
