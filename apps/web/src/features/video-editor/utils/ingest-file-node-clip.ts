import { useVideoEditorStore } from "../store/editor-store"
import { secondsToFrames } from "./time"
import { probeImageDimensions, probeMediaDuration } from "./media-probe"
import { getFileContent } from "@/features/editor/requests"

type MediaFormat = "video" | "audio" | "image"

type DropGuide =
  | { mode: "insert"; targetIndex: number; valid: boolean }
  | { mode: "create"; insertIndex: number }

export type IngestMediaSource = {
  id: string
  name: string
  format: MediaFormat
  /** When present, skips a second content fetch (e.g. assets library drag). */
  url?: string | null
}

export type IngestFileNodeClipParams = {
  projectId: string
  node: IngestMediaSource
  startFrame: number
  guide: DropGuide | null
}

function resolveTrackId(
  guide: DropGuide | null,
  format: MediaFormat,
): string | undefined {
  const { tracks, insertTrackAt } = useVideoEditorStore.getState()

  if (!guide) return undefined

  if (guide.mode === "insert") {
    if (!guide.valid) return undefined
    return tracks[guide.targetIndex]?.id
  }

  return insertTrackAt(format, guide.insertIndex)
}

async function resolveMediaUrl(
  projectId: string,
  node: IngestMediaSource,
): Promise<{ url: string; name: string } | null> {
  if (node.url) {
    return { url: node.url, name: node.name }
  }

  const content = await getFileContent(projectId, node.id)
  if (content.type !== node.format) return null
  return { url: content.url, name: content.name }
}

export async function ingestFileNodeClip({
  projectId,
  node,
  startFrame,
  guide,
}: IngestFileNodeClipParams): Promise<string | null> {
  if (guide?.mode === "insert" && !guide.valid) return null

  const media = await resolveMediaUrl(projectId, node)
  if (!media) return null

  const trackId = resolveTrackId(guide, node.format)
  if (guide?.mode === "insert" && guide.valid && !trackId) return null

  const { fps, addVideoClip, addAudioClip, addImageClip } =
    useVideoEditorStore.getState()

  const base = {
    trackId,
    startFrame,
    url: media.url,
    fileName: media.name,
  }

  if (node.format === "video") {
    const seconds = await probeMediaDuration(media.url, "video")
    return addVideoClip({
      ...base,
      durationInFrames: secondsToFrames(seconds, fps),
    })
  }

  if (node.format === "audio") {
    const seconds = await probeMediaDuration(media.url, "audio")
    return addAudioClip({
      ...base,
      durationInFrames: secondsToFrames(seconds, fps),
    })
  }

  const dims = await probeImageDimensions(media.url)
  return addImageClip({
    ...base,
    width: dims.width,
    height: dims.height,
    durationInFrames: fps * 5,
  })
}
