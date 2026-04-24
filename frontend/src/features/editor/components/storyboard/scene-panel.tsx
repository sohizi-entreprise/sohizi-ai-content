import {
  Play,
  MapPin,
  Clock,
  ChevronDown,
  Plus,
  Users,
  Music,
  Mic,
  Shirt,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MOCK_SCENES } from '../../mock-data'

function MetadataRow({ icon: Icon, label }: { icon: typeof MapPin; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="text-muted-foreground">{label}</span>
      <ChevronDown className="ml-auto size-3 text-muted-foreground" />
    </div>
  )
}

function SceneCard({ scene, index }: { scene: typeof MOCK_SCENES[0]; index: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-foreground">
              Scene {scene.number}
            </span>
            <Button variant="ghost" size="icon" className="size-5 text-primary">
              <Play className="size-3" />
            </Button>
            {index === 0 && (
              <span className="text-[10px] text-muted-foreground">
                Page 1/9
              </span>
            )}
          </div>
          <p className="text-xs font-medium text-primary">
            {scene.heading}
          </p>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            {scene.description}
          </p>
        </div>
      </div>

      <div className="space-y-2 rounded-md bg-muted/30 p-2">
        <div className="flex items-center gap-2 text-xs">
          <MapPin className="size-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">{scene.location}</span>
        </div>
        <MetadataRow icon={Shirt} label="Clothing" />
        <MetadataRow icon={Music} label="Background Sound" />
        <MetadataRow icon={Mic} label="Voiceover" />
        <div className="flex items-center gap-2 text-xs">
          <Clock className="size-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">{scene.timeOfDay}</span>
          <span className="ml-auto text-muted-foreground">{scene.time}</span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <div className="flex -space-x-1.5">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="size-5 rounded-full border border-background bg-primary/20"
            />
          ))}
        </div>
      </div>

      {index === 0 && (
        <Button size="sm" className="w-full h-7 text-xs bg-primary/20 text-primary hover:bg-primary/30">
          <Play className="mr-1 size-3" /> Animatic
        </Button>
      )}
    </div>
  )
}

export function ScenePanel() {
  return (
    <div className="flex h-full flex-col border-r border-border">
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="text-xs font-semibold text-foreground">Storyboard</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-5 text-muted-foreground hover:text-foreground">
            <Plus className="size-3" />
          </Button>
          <Button variant="ghost" size="icon" className="size-5 text-muted-foreground hover:text-foreground">
            <Users className="size-3" />
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-3">
          {MOCK_SCENES.map((scene, i) => (
            <SceneCard key={scene.id} scene={scene} index={i} />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
