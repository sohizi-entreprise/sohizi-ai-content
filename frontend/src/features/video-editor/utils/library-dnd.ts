import type { FontWeight, TextAlign } from '../store/types'

export const VIDEO_EDITOR_TEXT_PRESET_DRAG_TYPE = 'VIDEO_EDITOR_TEXT_PRESET'
export const TIMELINE_DROP_AREA_ATTR = 'data-video-editor-timeline-drop'

export type TextPresetStyle = {
  text: string
  fontSize?: number
  color?: string
  fontFamily?: string
  fontWeight?: FontWeight
  align?: TextAlign
  opacity?: number
  xRatio?: number
  yRatio?: number
  widthRatio?: number
  heightRatio?: number
}

export type TextPresetDragItem = {
  presetId: string
  label: string
  style: TextPresetStyle
}

/** Marks file-tree NODE drags that originate from the Add library panel. */
export type LibraryAssetDragItem = {
  id: string
  dragIds: string[]
  fromLibrary: true
  label: string
}

export function isPointerOverTimelineDropArea(
  clientOffset: { x: number; y: number } | null,
): boolean {
  if (!clientOffset || typeof document === 'undefined') return false
  const el = document.querySelector(`[${TIMELINE_DROP_AREA_ATTR}]`)
  if (!el) return false
  const rect = el.getBoundingClientRect()
  return (
    clientOffset.x >= rect.left &&
    clientOffset.x <= rect.right &&
    clientOffset.y >= rect.top &&
    clientOffset.y <= rect.bottom
  )
}

type ClearTimelineDropPreview = () => void

let clearTimelineDropPreview: ClearTimelineDropPreview | null = null

/** Timeline registers its overlay clearer so drag sources can flush on `end`. */
export function registerTimelineDropPreviewClear(
  fn: ClearTimelineDropPreview | null,
) {
  clearTimelineDropPreview = fn
}

export function flushTimelineDropPreview() {
  clearTimelineDropPreview?.()
}
