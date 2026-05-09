export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:5'

export type TrackType = 'video' | 'audio' | 'text' | 'image'

export type TextAlign = 'left' | 'center' | 'right'

export type FontWeight = 'normal' | 'bold' | number

export interface BaseClip {
  id: string
  trackId: string
  startFrame: number
  endFrame: number
  sourceStartFrame: number
  sourceDurationInFrames: number
}

export interface VideoClip extends BaseClip {
  type: 'video'
  url: string
  fileName: string
  width?: number
  height?: number
  volume: number
  opacity: number
  speed: number
  borderRadius: number
}

export interface AudioClip extends BaseClip {
  type: 'audio'
  url: string
  fileName: string
  volume: number
  speed: number
}

export interface TextClip extends BaseClip {
  type: 'text'
  text: string
  fontSize: number
  color: string
  fontFamily: string
  fontWeight: FontWeight
  align: TextAlign
  opacity: number
  xRatio: number
  yRatio: number
  widthRatio: number
  heightRatio: number
}

export interface ImageClip extends BaseClip {
  type: 'image'
  url: string
  fileName: string
  width?: number
  height?: number
  opacity: number
  borderRadius: number
  blur: number
  brightness: number
  xRatio: number
  yRatio: number
  widthRatio: number
  heightRatio: number
}

export type Clip = VideoClip | AudioClip | TextClip | ImageClip

export interface Track {
  id: string
  type: TrackType
  name: string
  muted: boolean
  hidden: boolean
  clips: Array<Clip>
}

export interface Viewport {
  startSec: number
  endSec: number
}

export interface Selection {
  clipIds: Array<string>
}

export interface ProjectState {
  fps: number
  durationInFrames: number
  currentFrame: number
  aspectRatio: AspectRatio
  width: number
  height: number
  zoomScale: number
  viewport: Viewport
  tracks: Array<Track>
  selection: Selection
  isPlaying: boolean
}

export const ASPECT_RATIO_DIMENSIONS: Record<
  AspectRatio,
  { width: number; height: number }
> = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
}
