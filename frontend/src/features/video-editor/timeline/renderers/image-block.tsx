import { ImageIcon } from 'lucide-react'
import { ClipShell } from './clip-shell'
import type { ImageClip } from '../../store/types'

interface ImageBlockProps {
  clip: ImageClip
  selected: boolean
}

export function ImageBlock({ clip, selected }: ImageBlockProps) {
  return (
    <ClipShell
      type="image"
      selected={selected}
      label={clip.fileName}
      icon={ImageIcon}
      labelOverlay
    >
      <img
        src={clip.url}
        alt=""
        draggable={false}
        className="h-full w-full object-cover"
      />
    </ClipShell>
  )
}
