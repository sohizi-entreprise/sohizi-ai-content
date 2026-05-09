import { ImageIcon } from 'lucide-react'
import type { ImageClip } from '../../store/types'
import { cn } from '@/lib/utils'

interface ImageBlockProps {
  clip: ImageClip
  selected: boolean
}

export function ImageBlock({ clip, selected }: ImageBlockProps) {
  return (
    <div
      className={cn(
        'flex h-full w-full items-stretch overflow-hidden rounded-md border',
        selected ? 'border-white ring-2 ring-white' : 'border-emerald-700/60',
      )}
      style={{
        background: selected
          ? 'linear-gradient(180deg, #10b981 0%, #059669 100%)'
          : 'linear-gradient(180deg, #059669 0%, #047857 100%)',
      }}
      title={clip.fileName}
    >
      <div className="flex h-full items-center gap-1 pl-2 pr-1 text-[11px] text-emerald-50">
        <ImageIcon className="size-3 shrink-0" />
        <span className="max-w-[110px] truncate">{clip.fileName}</span>
      </div>
      <div className="relative h-full flex-1 overflow-hidden">
        <img
          src={clip.url}
          alt=""
          draggable={false}
          className="h-full w-full object-cover opacity-90"
        />
      </div>
    </div>
  )
}
