import { useVideoEditorStore } from '../store/editor-store'
import type { TextPresetStyle } from './library-dnd'

type DropGuide =
  | { mode: 'insert'; targetIndex: number; valid: boolean }
  | { mode: 'create'; insertIndex: number }

export type IngestTextPresetClipParams = {
  style: TextPresetStyle
  startFrame: number
  guide: DropGuide | null
}

function resolveTextTrackId(guide: DropGuide | null): string | undefined {
  const { tracks, insertTrackAt } = useVideoEditorStore.getState()

  if (!guide) return undefined

  if (guide.mode === 'insert') {
    if (!guide.valid) return undefined
    return tracks[guide.targetIndex]?.id
  }

  return insertTrackAt('text', guide.insertIndex)
}

export function ingestTextPresetClip({
  style,
  startFrame,
  guide,
}: IngestTextPresetClipParams): string | null {
  if (guide?.mode === 'insert' && !guide.valid) return null

  const trackId = resolveTextTrackId(guide)
  if (guide?.mode === 'insert' && guide.valid && !trackId) return null

  const { fps, addTextClip } = useVideoEditorStore.getState()
  const { text, ...rest } = style

  return addTextClip({
    trackId,
    text,
    startFrame,
    durationInFrames: fps * 5,
    ...rest,
  })
}
