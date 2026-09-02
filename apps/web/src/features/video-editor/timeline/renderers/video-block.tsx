import { useEffect, useRef, useState } from "react"
import { Film } from "lucide-react"
import { getVideoThumbnails } from "../thumbnails"
import { ClipShell } from "./clip-shell"
import type { VideoClip } from "../../store/types"

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

  const hasThumbs = thumbs.length > 0

  return (
    <ClipShell
      type="video"
      selected={selected}
      label={clip.fileName}
      icon={Film}
      labelOverlay={hasThumbs}
    >
      {hasThumbs ? (
        <div className="flex h-full w-full items-stretch">
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
      ) : null}
    </ClipShell>
  )
}
