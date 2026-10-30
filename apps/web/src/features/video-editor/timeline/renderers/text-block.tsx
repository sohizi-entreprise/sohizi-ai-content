import { Type } from "lucide-react"
import { ClipShell, getClipFadeRatios } from "./clip-shell"
import type { TextClip } from "../../store/types"

interface TextBlockProps {
  clip: TextClip
  selected: boolean
}

export function TextBlock({ clip, selected }: TextBlockProps) {
  const label = clip.text || "Text"
  const { fadeInRatio, fadeOutRatio } = getClipFadeRatios(clip)

  return (
    <ClipShell
      type="text"
      selected={selected}
      label={label}
      icon={Type}
      fadeInRatio={fadeInRatio}
      fadeOutRatio={fadeOutRatio}
    />
  )
}
