import { TextSettings } from "./text-settings"
import { VideoSettings } from "./video-settings"
import { ImageSettings } from "./image-settings"
import { AudioSettings } from "./audio-settings"
import { HtmlSettings } from "./html-settings"
import { CaptionSettings } from "./caption-settings"
import type { Clip } from "../../store/types"

export const CLIP_TYPE_LABEL: Record<Clip["type"], string> = {
  text: "Text",
  video: "Video",
  image: "Image",
  audio: "Audio",
  html: "HTML",
  caption: "Caption",
}

export function ClipSettings({ clip }: { clip: Clip }) {
  switch (clip.type) {
    case "text":
      return <TextSettings clip={clip} />
    case "video":
      return <VideoSettings clip={clip} />
    case "image":
      return <ImageSettings clip={clip} />
    case "audio":
      return <AudioSettings clip={clip} />
    case "html":
      return <HtmlSettings clip={clip} />
    case "caption":
      return <CaptionSettings clip={clip} />
    default:
      return null
  }
}
