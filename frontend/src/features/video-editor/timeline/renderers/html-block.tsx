import { Code2 } from 'lucide-react'
import type { HtmlClip } from '../../store/types'
import { cn } from '@/lib/utils'

export function getHtmlClipLabel(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  if (titleMatch?.[1]?.trim()) return titleMatch[1].trim()
  return 'HTML'
}

interface HtmlBlockProps {
  clip: HtmlClip
  selected: boolean
}

export function HtmlBlock({ clip, selected }: HtmlBlockProps) {
  const label = getHtmlClipLabel(clip.html)

  return (
    <div
      className={cn(
        'flex h-full w-full items-center gap-1.5 overflow-hidden rounded-md border px-2 text-[11px] text-violet-50',
        selected ? 'border-white ring-2 ring-white' : 'border-violet-700/60',
      )}
      style={{
        background: selected
          ? 'linear-gradient(180deg, #8b5cf6 0%, #7c3aed 100%)'
          : 'linear-gradient(180deg, #7c3aed 0%, #6d28d9 100%)',
      }}
      title={label}
    >
      <Code2 className="size-3 shrink-0" />
      <span className="truncate">{label}</span>
    </div>
  )
}
