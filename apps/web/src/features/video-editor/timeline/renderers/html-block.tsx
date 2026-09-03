import { Code2 } from "lucide-react"
import { ClipShell } from "./clip-shell"
import type { HtmlClip } from "../../store/types"

export function getHtmlClipLabel(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  if (titleMatch?.[1]?.trim()) return titleMatch[1].trim()
  return "HTML"
}

interface HtmlBlockProps {
  clip: HtmlClip
  selected: boolean
}

export function HtmlBlock({ clip, selected }: HtmlBlockProps) {
  const label = getHtmlClipLabel(clip.html)

  return (
    <ClipShell
      type="html"
      selected={selected}
      label={label}
      icon={Code2}
    />
  )
}
