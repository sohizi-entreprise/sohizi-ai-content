import {
  AudioLines,
  Clapperboard,
  ImageIcon,
  Maximize2,
  Repeat2,
  Speech,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type {
  AudioSubtype,
  GenerationSubtype,
  GenerationType,
  ImageSubtype,
  UpscalerSubtype,
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
  { value: "motion-transfer", label: "Motion transfer", icon: Repeat2 },
  { value: "lip-sync", label: "Lip sync", icon: Speech },
  { value: "upscaler", label: "Upscaler", icon: Maximize2 },
]

export const IMAGE_SUBTYPES: Array<{ value: ImageSubtype; label: string }> = [
  { value: "from-text", label: "From text" },
  { value: "from-image", label: "From image" },
]

export const VIDEO_SUBTYPES: Array<{ value: VideoSubtype; label: string }> = [
  { value: "create", label: "Create" },
  { value: "edit", label: "Edit" },
]

export const AUDIO_SUBTYPES: Array<{ value: AudioSubtype; label: string }> = [
  { value: "tts", label: "Text to speech" },
  { value: "music", label: "Music" },
]

export const UPSCALER_SUBTYPES: Array<{
  value: UpscalerSubtype
  label: string
}> = [
  { value: "image", label: "Image" },
  { value: "video", label: "Video" },
]

export function getDefaultSubtype(
  type: GenerationType,
): GenerationSubtype | null {
  if (type === "image") return "from-text"
  if (type === "video") return "create"
  if (type === "audio") return "tts"
  if (type === "upscaler") return "image"
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
    case "motion-transfer":
      return "Motion Transfer"
    case "lip-sync":
      return "Lip Sync"
    case "upscaler":
      return "Upscaler"
  }
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
      return subtype === "music" ? ["music-generation"] : ["text-to-speech"]
    case "motion-transfer":
      return ["motion-transfer"]
    case "lip-sync":
      return ["lip-sync"]
    case "upscaler":
      return subtype === "video" ? ["video-upscaler"] : ["image-upscaler"]
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
    case "lip-sync":
      return "video"
    case "audio":
      return subtype === "music" ? "music" : "audio"
    case "upscaler":
      return subtype === "video" ? "video" : "image"
  }
}
