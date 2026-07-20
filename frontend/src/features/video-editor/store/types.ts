import type { CompositionVariable } from '@hyperframes/core'

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:5'

export type TrackType = 'video' | 'audio' | 'text' | 'image' | 'html' | 'caption'

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

export interface SpatialLayout {
  xRatio: number
  yRatio: number
  widthRatio: number
  heightRatio: number
}

export interface VideoClip extends BaseClip, SpatialLayout {
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

export interface TextClip extends BaseClip, SpatialLayout {
  type: 'text'
  text: string
  fontSize: number
  color: string
  fontFamily: string
  fontWeight: FontWeight
  align: TextAlign
  opacity: number
}

export interface ImageClip extends BaseClip, SpatialLayout {
  type: 'image'
  url: string
  fileName: string
  width?: number
  height?: number
  opacity: number
  borderRadius: number
  blur: number
  brightness: number
}

export interface HtmlClip extends BaseClip, SpatialLayout {
  type: 'html'
  html: string
  variables: CompositionVariable[]                       // schema — declared once by the AI
  values: Record<string, string | number | boolean>      // user-set overrides
}

export type ServerCaption = {
  word: string,
  start: number,
  end: number,
}

export interface CaptionClip extends BaseClip {
  type: 'caption'
  captions: {
    text: string,
    words: ServerCaption[]
  }
  properties: {
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
    hightlightColor?: string
    backgroundColor?: string
  }
}

/** Clip types that can be selected and transformed on the canvas. */
export type CanvasEditableClip =
  | TextClip
  | ImageClip
  | VideoClip
  | HtmlClip
  | CaptionClip

export function isCanvasEditableClip(clip: Clip): clip is CanvasEditableClip {
  return (
    clip.type === 'text' ||
    clip.type === 'image' ||
    clip.type === 'video' ||
    clip.type === 'html' ||
    clip.type === 'caption'
  )
}

export function getClipLayout(clip: CanvasEditableClip): SpatialLayout {
  if (clip.type === 'caption') {
    return {
      xRatio: clip.properties.xRatio,
      yRatio: clip.properties.yRatio,
      widthRatio: clip.properties.widthRatio,
      heightRatio: clip.properties.heightRatio,
    }
  }
  return {
    xRatio: clip.xRatio,
    yRatio: clip.yRatio,
    widthRatio: clip.widthRatio,
    heightRatio: clip.heightRatio,
  }
}

export type Clip = VideoClip | AudioClip | TextClip | ImageClip | HtmlClip | CaptionClip

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
