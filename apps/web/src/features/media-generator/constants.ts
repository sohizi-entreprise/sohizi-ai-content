import {
  AudioLines,
  Clapperboard,
  ImageIcon,
  Layers,
  Mic,
  Repeat2,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type {
  AudioSubtype,
  GenerationSubtype,
  GenerationType,
  ImageSubtype,
  VideoSubtype,
} from "./types"

export const GENERATION_TYPES: Array<{
  value: GenerationType
  label: string
  icon: LucideIcon
}> = [
  { value: "image", label: "Image", icon: ImageIcon },
  { value: "video", label: "Video", icon: Clapperboard },
  { value: "audio", label: "Audio", icon: AudioLines },
  { value: "motion-graphic", label: "Motion graphic", icon: Layers },
  { value: "motion-transfer", label: "Motion transfer", icon: Repeat2 },
  { value: "clone-voice", label: "Clone voice", icon: Mic },
]

export const IMAGE_SUBTYPES: Array<{ value: ImageSubtype; label: string }> = [
  { value: "from-text", label: "From text" },
  { value: "from-image", label: "From image" },
]

export const VIDEO_SUBTYPES: Array<{ value: VideoSubtype; label: string }> = [
  { value: "create", label: "Create" },
  { value: "edit", label: "Edit" },
  { value: "extend", label: "Extend" },
]

export const AUDIO_SUBTYPES: Array<{ value: AudioSubtype; label: string }> = [
  { value: "tts", label: "Text to speech" },
  { value: "music", label: "Music" },
  { value: "dialogue", label: "Dialogue" },
]

export function getDefaultSubtype(
  type: GenerationType,
): GenerationSubtype | null {
  if (type === "image") return "from-text"
  if (type === "video") return "create"
  if (type === "audio") return "tts"
  return null
}

export function getGeneratorTitle(type: GenerationType): string {
  switch (type) {
    case "image":
      return "Image Generator"
    case "video":
      return "Video Generator"
    case "audio":
      return "Audio Generator"
    case "motion-graphic":
      return "Motion Graphic"
    case "motion-transfer":
      return "Motion Transfer"
    case "clone-voice":
      return "Clone Voice"
  }
}

export function getPromptPlaceholder(
  type: GenerationType,
  subtype: GenerationSubtype | null,
): string {
  if (type === "audio" && subtype === "tts") {
    return "Enter text to convert to speech..."
  }
  if (type === "audio" && subtype === "music") {
    return "Describe the music you want to generate..."
  }
  if (type === "audio" && subtype === "dialogue") {
    return "Describe the conversation or paste a script..."
  }
  if (type === "clone-voice") {
    return "Describe how the cloned voice should speak..."
  }
  if (type === "motion-graphic") {
    return "Describe the motion graphic you want to create..."
  }
  if (type === "motion-transfer") {
    return "Describe the motion you want to transfer..."
  }
  if (type === "video") {
    return "Describe the video you want to generate..."
  }
  if (type === "image" && subtype === "from-image") {
    return "Describe how you want to transform the image..."
  }
  return "Describe the image you want to generate..."
}

export function getCatalogCategories(
  type: GenerationType,
  subtype: GenerationSubtype | null,
): Array<string> {
  switch (type) {
    case "image":
      return subtype === "from-image" ? ["image-to-image"] : ["text-to-image"]
    case "video":
      return subtype === "create"
        ? ["text-to-video"]
        : ["video-to-video", "image-to-video"]
    case "audio":
      return subtype === "music" ? [] : ["text-to-speech"]
    case "motion-transfer":
      return ["video-to-video", "image-to-video"]
    default:
      return []
  }
}

export function getAgentMediaType(
  type: GenerationType,
  subtype: GenerationSubtype | null,
): string {
  switch (type) {
    case "image":
      return "image"
    case "video":
    case "motion-transfer":
      return "video"
    case "motion-graphic":
      return "html"
    case "audio":
      if (subtype === "music") return "music"
      if (subtype === "dialogue") return "dialogue"
      return "audio"
    case "clone-voice":
      return "audio"
  }
}

export function showsVoiceSelector(
  type: GenerationType,
  subtype: GenerationSubtype | null,
): boolean {
  return type === "audio" && (subtype === "tts" || subtype === "dialogue")
}

export function showsAgentMode(type: GenerationType): boolean {
  return type === "image" || type === "video"
}
