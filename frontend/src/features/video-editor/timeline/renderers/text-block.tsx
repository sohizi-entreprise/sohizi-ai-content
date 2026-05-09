import { Type } from 'lucide-react'
import type { TextClip } from '../../store/types'
import { cn } from '@/lib/utils'

interface TextBlockProps {
  clip: TextClip
  selected: boolean
}

export function TextBlock({ clip, selected }: TextBlockProps) {
  return (
    <div
      className={cn(
        'flex h-full w-full items-center gap-1.5 overflow-hidden rounded-md border px-2 text-[11px] text-sky-50',
        selected ? 'border-white ring-2 ring-white' : 'border-sky-700/60',
      )}
      style={{
        background: selected
          ? 'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)'
          : 'linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%)',
      }}
      title={clip.text}
    >
      <Type className="size-3 shrink-0" />
      <span className="truncate">{clip.text || 'Text'}</span>
    </div>
  )
}
