import { Type } from 'lucide-react'
import { ClipShell } from './clip-shell'
import type { TextClip } from '../../store/types'

interface TextBlockProps {
  clip: TextClip
  selected: boolean
}

export function TextBlock({ clip, selected }: TextBlockProps) {
  const label = clip.text || 'Text'

  return <ClipShell type="text" selected={selected} label={label} icon={Type} />
}
