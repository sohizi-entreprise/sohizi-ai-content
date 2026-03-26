import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useScriptStore } from '@/features/projects/store/script-store'
import { cn } from '@/lib/utils'
import { IconX } from '@tabler/icons-react'
import { Route } from '@/routes/dashboard/projects/$projectId/edit/script'
import { useNavigate } from '@tanstack/react-router'

type Scene = {
  id: string
  number: number
  heading: string
  description: string
}

// type SceneListPanelProps = {
//   scenes: Scene[]
//   onAddScene: () => void
// }

export default function SceneListPanel() {

  const showLayers = useScriptStore(state => state.showLayers.scenes)
  const toggleLayer = useScriptStore(state => state.toggleLayer)

  const scenes: Scene[] = []

  const navigate = useNavigate({from: Route.id})

  const onSceneClick = (sceneId: string) => {
    navigate({hash: sceneId})
  }



  if (!showLayers) {
    return null
  }

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
            onClick={()=>toggleLayer('scenes')}
          >
            <IconX className="size-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {scenes.map((scene) => (
              <button
                key={scene.id}
                onClick={() => onSceneClick(scene.id)}
                className={cn(
                  'w-full text-left px-3 py-3 rounded-md transition-colors',
                  'hover:bg-white/5')}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xs text-muted-foreground font-mono mt-0.5">
                    {String(scene.number).padStart(2, '0')}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        'text-sm font-medium truncate text-foreground',
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
      </div>

      <div className="flex-1 bg-black/40" onClick={()=>toggleLayer('scenes')} />
    </div>
  )
}
