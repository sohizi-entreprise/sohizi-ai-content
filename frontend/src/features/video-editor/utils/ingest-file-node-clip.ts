import { getFileContent } from '@/features/editor/requests'
import type { FileTreeNode } from '@/features/editor/types'
import { useVideoEditorStore } from '../store/editor-store'
import { secondsToFrames } from './time'
import { probeImageDimensions, probeMediaDuration } from './media-probe'

type MediaFormat = 'video' | 'audio' | 'image'

type DropGuide =
  | { mode: 'insert'; targetIndex: number; valid: boolean }
  | { mode: 'create'; insertIndex: number }

export type IngestFileNodeClipParams = {
  projectId: string
  node: FileTreeNode & { format: MediaFormat }
  startFrame: number
  guide: DropGuide | null
}

function resolveTrackId(guide: DropGuide | null, format: MediaFormat): string | undefined {
  const { tracks, insertTrackAt } = useVideoEditorStore.getState()

  if (!guide) return undefined

  if (guide.mode === 'insert') {
    if (!guide.valid) return undefined
    return tracks[guide.targetIndex]?.id
  }

  return insertTrackAt(format, guide.insertIndex)
}

export async function ingestFileNodeClip({
  projectId,
  node,
  startFrame,
  guide,
}: IngestFileNodeClipParams): Promise<string | null> {
  if (guide?.mode === 'insert' && !guide.valid) return null

  const content = await getFileContent(projectId, node.id)
  if (content.type !== node.format) return null

  const trackId = resolveTrackId(guide, node.format)
  if (guide?.mode === 'insert' && guide.valid && !trackId) return null

  const { fps, addVideoClip, addAudioClip, addImageClip } =
    useVideoEditorStore.getState()

  const base = {
    trackId,
    startFrame,
    url: content.url,
    fileName: content.name,
  }

  if (node.format === 'video') {
    const seconds = await probeMediaDuration(content.url, 'video')
    return addVideoClip({
      ...base,
      durationInFrames: secondsToFrames(seconds, fps),
    })
  }

  if (node.format === 'audio') {
    const seconds = await probeMediaDuration(content.url, 'audio')
    return addAudioClip({
      ...base,
      durationInFrames: secondsToFrames(seconds, fps),
    })
  }

  const dims = await probeImageDimensions(content.url)
  return addImageClip({
    ...base,
    width: dims.width,
    height: dims.height,
    durationInFrames: fps * 5,
  })
}
