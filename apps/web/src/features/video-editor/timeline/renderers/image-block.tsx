import { ImageIcon } from "lucide-react"
import { ClipShell, getClipFadeRatios } from "./clip-shell"
import type { ImageClip } from "../../store/types"
import { thumbnailImageUrl } from "@/utils/transform-url"

interface ImageBlockProps {
  clip: ImageClip
  selected: boolean
}

export function ImageBlock({ clip, selected }: ImageBlockProps) {
  const { fadeInRatio, fadeOutRatio } = getClipFadeRatios(clip)

  return (
    <ClipShell
      type="image"
      selected={selected}
      label={clip.fileName}
      icon={ImageIcon}
      labelOverlay
      fadeInRatio={fadeInRatio}
      fadeOutRatio={fadeOutRatio}
    >
      <img
        src={thumbnailImageUrl(clip.url)}
        alt=""
        draggable={false}
        className="h-full w-full object-cover"
      />
    </ClipShell>
  )
}
