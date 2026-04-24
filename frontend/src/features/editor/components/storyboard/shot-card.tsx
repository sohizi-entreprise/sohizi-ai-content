import { Music, UserCircle } from 'lucide-react'

interface ShotCardProps {
  shot: {
    id: string
    number: number
    dialogue: string
    audio: string
  }
}

export function ShotCard({ shot }: ShotCardProps) {
  return (
    <div className="flex w-[180px] shrink-0 flex-col rounded-lg border border-border bg-card overflow-hidden">
      {/* Shot thumbnail placeholder */}
      <div className="relative aspect-video w-full bg-muted/40">
        <div className="absolute left-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-primary/80 text-[10px] font-bold text-primary-foreground">
          {shot.number}
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <UserCircle className="size-8 text-muted-foreground/30" />
        </div>
      </div>

      {/* Shot details */}
      <div className="flex flex-1 flex-col gap-1.5 p-2">
        <p className="text-[11px] leading-relaxed text-muted-foreground line-clamp-3">
          {shot.dialogue}
        </p>
        {shot.dialogue.length > 60 && (
          <p className="text-[10px] italic text-muted-foreground/60 line-clamp-2">
            sed do eiusmod tempor incididunt ut eismod tempor incididunt ut labore
          </p>
        )}
      </div>

      {/* Avatars row */}
      <div className="flex items-center gap-1 px-2 pb-1.5">
        <div className="flex -space-x-1">
          {[...Array(2)].map((_, i) => (
            <div
              key={i}
              className="size-4 rounded-full border border-card bg-primary/20"
            />
          ))}
        </div>
        {shot.number <= 2 && (
          <div className="ml-auto flex size-4 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
            +
          </div>
        )}
      </div>

      {/* Audio footer */}
      <div className="flex items-center gap-1.5 border-t border-border px-2 py-1.5">
        <Music className="size-3 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground">{shot.audio}</span>
      </div>
    </div>
  )
}
