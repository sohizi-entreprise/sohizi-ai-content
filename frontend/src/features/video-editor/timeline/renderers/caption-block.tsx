import { Subtitles } from 'lucide-react'
import { ClipShell } from './clip-shell'
import type { CaptionClip } from '../../store/types'

interface CaptionBlockProps {
  clip: CaptionClip
  selected: boolean
  durationSec: number
}

export function CaptionBlock({ selected }: CaptionBlockProps) {
  return (
    <ClipShell
      type="caption"
      selected={selected}
      label="Caption"
      icon={Subtitles}
    />
  )
}
