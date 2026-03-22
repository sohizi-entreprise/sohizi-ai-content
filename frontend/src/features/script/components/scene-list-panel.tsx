import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { IconPlus, IconX } from '@tabler/icons-react'

type Scene = {
  id: string
  number: number
  heading: string
  description: string
}

type SceneListPanelProps = {
  scenes: Scene[]
  selectedSceneId: string
  onSelectScene: (sceneId: string) => void
  onAddScene: () => void
  onClose: () => void
}

export default function SceneListPanel({
  scenes,
  selectedSceneId,
  onSelectScene,
  onAddScene,
  onClose,
}: SceneListPanelProps) {
  return (
    <div className="absolute inset-0 z-20 flex">
      <div className="w-[300px] bg-background/95 backdrop-blur-xl border-r border-white/10 flex flex-col shadow-2xl">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Scenes
          </h2>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-foreground"
            onClick={onClose}
          >
            <IconX className="size-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {scenes.map((scene) => (
              <button
                key={scene.id}
                onClick={() => onSelectScene(scene.id)}
                className={cn(
                  'w-full text-left px-3 py-3 rounded-md transition-colors',
                  'hover:bg-white/5',
                  selectedSceneId === scene.id
                    ? 'bg-primary/10 border-l-2 border-primary'
                    : 'border-l-2 border-transparent'
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xs text-muted-foreground font-mono mt-0.5">
                    {String(scene.number).padStart(2, '0')}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        'text-sm font-medium truncate',
                        selectedSceneId === scene.id ? 'text-primary' : 'text-foreground'
                      )}
                    >
                      {scene.heading}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {scene.description}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>

        <div className="p-3 pb-16 border-t border-white/10">
          <button
            onClick={onAddScene}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-dashed border-white/20 text-muted-foreground hover:text-foreground hover:border-white/40 transition-colors text-sm"
          >
            <IconPlus className="size-4" />
            Add Scene
          </button>
        </div>
      </div>

      <div className="flex-1 bg-black/40" onClick={onClose} />
    </div>
  )
}
