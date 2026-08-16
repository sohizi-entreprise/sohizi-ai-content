import { ReactNode } from "react"

export type MediaType = 'image' | 'video' | 'audio' | 'html'

export type GenerationType =
  | 'image'
  | 'video'
  | 'audio'
  | 'motion-graphic'
  | 'motion-transfer'
  | 'clone-voice'

export type VideoSubtype = 'create' | 'edit' | 'extend'
export type AudioSubtype = 'tts' | 'music' | 'dialogue'
export type GenerationSubtype = VideoSubtype | AudioSubtype

/** @deprecated Use GenerationType */
export type ComposerMediaType = GenerationType

export type MediaFilter = 'all' | 'image' | 'video' | 'audio' | 'html'

export type HtmlAssetVariable = {
  id: string
  type: 'string' | 'number' | 'color' | 'boolean' | 'enum'
  label: string
  description?: string
  default: string | number | boolean
  min?: number
  max?: number
  step?: number
  options?: Array<{ value: string; label: string }>
}

export type HtmlAssetMetadata = {
  size?: number
  contentType?: string
  duration?: number
  width?: number
  height?: number
  variables?: HtmlAssetVariable[]
  values?: Record<string, string | number | boolean>
  compositionId?: string
}

export type MediaAspectRatio = '1:1' | '4:3' | '16:9' | '9:16'

export type MediaResolution = '720p' | '1080p' | '4K'

export type MediaVariant = {
  id: string
  url: string
  width?: number
  height?: number
}

export type ImageGenerationSettings = {
  model: string
  variations: number
  cameraAngle: string
  resolution: MediaResolution
  aspectRatio: MediaAspectRatio
}

export type VideoGenerationSettings = {
  model: string
  duration: number
  resolution: MediaResolution
  aspectRatio: MediaAspectRatio
}

export type AudioGenerationSettings = {
  model: string
  voice: string
  speed: number
  stability: number
}

export type MediaTuning = {
  label: string
  key: string
  currentValue?: string
  options: Array<{
      value: string
      label: string
      icon?: ReactNode
  }>
}


