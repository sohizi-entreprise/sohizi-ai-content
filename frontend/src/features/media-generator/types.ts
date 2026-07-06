import { ReactNode } from "react"

export type MediaType = 'image' | 'video' | 'audio'

export type MediaFilter = 'all' | 'image' | 'video' | 'audio'

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

export type MediaGenerationSettings = Record<MediaType, MediaTuning[]>


