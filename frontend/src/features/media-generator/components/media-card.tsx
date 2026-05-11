import { FilePlus2, MoreVertical, Play, Trash2, Volume2 } from 'lucide-react'
import type { GeneratedMediaItem } from '../types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

type MediaCardProps = {
  item: GeneratedMediaItem
  onPreview: (item: GeneratedMediaItem) => void
  onDelete: (id: string) => void
  onMoveToFile: (item: GeneratedMediaItem) => void
}

export function MediaCard({
  item,
  onPreview,
  onDelete,
  onMoveToFile,
}: MediaCardProps) {
  const variationsCount = item.variants?.length ?? 0

  if (item.type === 'audio') {
    return (
      <article className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <CardMenu
          onDelete={() => onDelete(item.id)}
          onMoveToFile={() => onMoveToFile(item)}
        />
        <div className="flex aspect-video flex-col justify-between rounded-xl border border-white/10 bg-gradient-to-br from-purple-500/20 via-sky-500/10 to-black p-4">
          <div className="flex size-12 items-center justify-center rounded-full bg-white/10 text-white">
            <Volume2 className="size-5" />
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-white">{item.title}</p>
              <p className="text-xs text-zinc-400">{item.model}</p>
            </div>
            <audio src={item.url} controls className="h-9 w-full" />
          </div>
        </div>
      </article>
    )
  }

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
      <button
        type="button"
        onClick={() => onPreview(item)}
        className="block w-full text-left"
      >
        <div className="relative aspect-video overflow-hidden bg-black">
          {item.type === 'image' ? (
            <img
              src={item.thumbnailUrl}
              alt={item.title}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            />
          ) : (
            <>
              <img
                src={item.thumbnailUrl}
                alt={item.title}
                className="h-full w-full object-cover opacity-80 transition duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur">
                  <Play className="ml-0.5 size-5 fill-current" />
                </span>
              </div>
            </>
          )}

          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/65 to-transparent p-4 pt-12">
            <p className="line-clamp-1 text-sm font-medium text-white">
              {item.title}
            </p>
            <p className="text-xs text-zinc-300">{item.model}</p>
          </div>

          {variationsCount > 1 ? (
            <Badge className="absolute left-3 top-3 rounded-full bg-black/60 text-white backdrop-blur">
              {variationsCount} variations
            </Badge>
          ) : null}
        </div>
      </button>

      <CardMenu
        className="absolute right-3 top-3"
        onDelete={() => onDelete(item.id)}
        onMoveToFile={() => onMoveToFile(item)}
      />
    </article>
  )
}

function CardMenu({
  className,
  onDelete,
  onMoveToFile,
}: {
  className?: string
  onDelete: () => void
  onMoveToFile: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className={cn(
            'rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70 hover:text-white',
            className,
          )}
          aria-label="Media actions"
        >
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="border-white/10 bg-black/90 text-white backdrop-blur-xl"
      >
        <DropdownMenuItem onClick={onMoveToFile}>
          <FilePlus2 className="size-4" />
          Move to file
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 className="size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
