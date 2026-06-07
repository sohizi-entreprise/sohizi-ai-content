import { Subtitles } from 'lucide-react'
import type { CaptionClip } from '../../store/types'
import { cn } from '@/lib/utils'

interface CaptionBlockProps {
  clip: CaptionClip
  selected: boolean
  durationSec: number
}

export function CaptionBlock({
  clip,
  selected,
  durationSec,
}: CaptionBlockProps) {
  const text = clip.captions.text || 'Caption'
  const words = clip.captions.words
  const hasWords = words.length > 0 && durationSec > 0

  return (
    <div
      className={cn(
        'flex h-full w-full items-stretch overflow-hidden rounded-md border',
        selected ? 'border-white ring-2 ring-white' : 'border-violet-600/70',
      )}
      style={{
        background: selected
          ? 'linear-gradient(180deg, #8b5cf6 0%, #7c3aed 100%)'
          : 'linear-gradient(180deg, #7c3aed 0%, #6d28d9 100%)',
      }}
      title={text}
    >
      <div className="flex h-full shrink-0 items-center gap-1 px-2 text-[11px] text-violet-50">
        <Subtitles className="size-3 shrink-0" />
      </div>
      <div className="relative h-full min-w-0 flex-1">
        {hasWords ? (
          <div className="absolute inset-0 overflow-hidden">
            {words.map((word, index) => {
              const leftPct = (word.start / durationSec) * 100
              const widthPct = Math.max(
                1.5,
                ((word.end - word.start) / durationSec) * 100,
              )
              return (
                <span
                  key={`${word.word}-${word.start}-${index}`}
                  className="absolute top-1/2 -translate-y-1/2 truncate rounded-sm bg-black/20 px-0.5 text-[9px] leading-none text-violet-50"
                  style={{
                    left: `${leftPct}%`,
                    maxWidth: `${widthPct}%`,
                  }}
                >
                  {word.word}
                </span>
              )
            })}
          </div>
        ) : (
          <div className="flex h-full items-center pr-2">
            <span className="truncate text-[11px] text-violet-50">{text}</span>
          </div>
        )}
      </div>
    </div>
  )
}
