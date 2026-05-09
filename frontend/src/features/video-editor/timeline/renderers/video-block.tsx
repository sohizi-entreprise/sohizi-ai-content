import { useEffect, useRef, useState } from 'react'
import { getVideoThumbnails } from '../thumbnails'
import type { VideoClip } from '../../store/types'
import { cn } from '@/lib/utils'

interface VideoBlockProps {
  clip: VideoClip
  selected: boolean
  durationSec: number
}

export function VideoBlock({ clip, selected, durationSec }: VideoBlockProps) {
  const [thumbs, setThumbs] = useState<Array<string>>([])
  const cancelledRef = useRef(false)

  useEffect(() => {
    cancelledRef.current = false
    getVideoThumbnails(clip.id, clip.url, durationSec)
      .then((list) => {
        if (!cancelledRef.current) setThumbs(list)
      })
      .catch(() => {
        if (!cancelledRef.current) setThumbs([])
      })
    return () => {
      cancelledRef.current = true
    }
  }, [clip.id, clip.url, durationSec])

  return (
    <div
      className={cn(
        'flex h-full w-full items-stretch overflow-hidden rounded-md border',
        selected ? 'border-white ring-2 ring-white' : 'border-sky-700/60',
      )}
      style={{
        background: selected
          ? 'linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%)'
          : 'linear-gradient(180deg, #1d4ed8 0%, #1e40af 100%)',
      }}
      title={clip.fileName}
    >
      <div className="flex h-full flex-1 items-stretch overflow-hidden">
        {thumbs.length === 0 ? (
          <div className="flex h-full w-full items-center px-2 text-[11px] text-sky-100/90">
            <span className="truncate">{clip.fileName}</span>
          </div>
        ) : (
          <div className="flex h-full flex-1 items-stretch">
            {thumbs.map((src, i) => (
              <img
                key={`${clip.id}-${i}`}
                src={src}
                alt=""
                className="h-full w-auto flex-1 object-cover"
                draggable={false}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
