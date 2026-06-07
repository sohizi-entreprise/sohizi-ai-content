import type {
  CaptionClip,
  Clip,
  Track,
  TrackType,
  VideoClip,
  AudioClip,
  TextClip,
  ImageClip,
  HtmlClip,
  AspectRatio,
  ServerCaption,
} from './store/types'
import type { BatchOperation, LoadCompositionResponse, ServerClip } from './requests'

// ============================================================================
// Server -> Store transforms
// ============================================================================

type ServerTrack = LoadCompositionResponse['tracks'][number]

function serverClipToStore(serverClip: ServerClip, trackType: TrackType): Clip {
  const base = {
    id: serverClip.id,
    trackId: serverClip.trackId,
    startFrame: serverClip.startFrame,
    endFrame: serverClip.endFrame,
    sourceStartFrame: serverClip.sourceStartFrame,
    sourceDurationInFrames: serverClip.sourceDurationInFrames,
  }

  const props = serverClip.properties ?? {}

  switch (trackType) {
    case 'video':
      return {
        ...base,
        type: 'video',
        url: (props.url as string) ?? '',
        fileName: (props.fileName as string) ?? '',
        width: props.width as number | undefined,
        height: props.height as number | undefined,
        volume: (props.volume as number) ?? 1,
        opacity: (props.opacity as number) ?? 1,
        speed: (props.speed as number) ?? 1,
        borderRadius: (props.borderRadius as number) ?? 0,
      } satisfies VideoClip
    case 'audio':
      return {
        ...base,
        type: 'audio',
        url: (props.url as string) ?? '',
        fileName: (props.fileName as string) ?? '',
        volume: (props.volume as number) ?? 1,
        speed: (props.speed as number) ?? 1,
      } satisfies AudioClip
    case 'text':
      return {
        ...base,
        type: 'text',
        text: (props.text as string) ?? '',
        fontSize: (props.fontSize as number) ?? 64,
        color: (props.color as string) ?? '#ffffff',
        fontFamily: (props.fontFamily as string) ?? 'Inter',
        fontWeight: (props.fontWeight as TextClip['fontWeight']) ?? 'bold',
        align: (props.align as TextClip['align']) ?? 'center',
        opacity: (props.opacity as number) ?? 1,
        xRatio: (props.xRatio as number) ?? 0.5,
        yRatio: (props.yRatio as number) ?? 0.85,
        widthRatio: (props.widthRatio as number) ?? 0.7,
        heightRatio: (props.heightRatio as number) ?? 0.18,
      } satisfies TextClip
    case 'image':
      return {
        ...base,
        type: 'image',
        url: (props.url as string) ?? '',
        fileName: (props.fileName as string) ?? '',
        width: props.width as number | undefined,
        height: props.height as number | undefined,
        opacity: (props.opacity as number) ?? 1,
        borderRadius: (props.borderRadius as number) ?? 0,
        blur: (props.blur as number) ?? 0,
        brightness: (props.brightness as number) ?? 100,
        xRatio: (props.xRatio as number) ?? 0.5,
        yRatio: (props.yRatio as number) ?? 0.5,
        widthRatio: (props.widthRatio as number) ?? 1,
        heightRatio: (props.heightRatio as number) ?? 1,
      } satisfies ImageClip
    case 'html':
      return {
        ...base,
        type: 'html',
        html: (props.html as string) ?? '',
        variables: (props.variables as HtmlClip['variables']) ?? [],
        values: (props.values as HtmlClip['values']) ?? {},
      } satisfies HtmlClip
    case 'caption':
      return {
        ...base,
        type: 'caption',
        captions: {
          text: (props.text as string) ?? '',
          words: (props.words as ServerCaption[]) ?? [],
        },
        properties: {
          fontSize: (props.fontSize as number) ?? 48,
          color: (props.color as string) ?? '#ffffff',
          fontFamily: (props.fontFamily as string) ?? 'Inter',
          fontWeight:
            (props.fontWeight as CaptionClip['properties']['fontWeight']) ??
            'bold',
          align: (props.align as CaptionClip['properties']['align']) ?? 'center',
          opacity: (props.opacity as number) ?? 1,
          xRatio: (props.xRatio as number) ?? 0.5,
          yRatio: (props.yRatio as number) ?? 0.85,
          widthRatio: (props.widthRatio as number) ?? 0.7,
          hightlightColor: props.hightlightColor as string | undefined,
          backgroundColor: props.backgroundColor as string | undefined,
        },
      } satisfies CaptionClip
  }
}

function serverTrackToStore(serverTrack: ServerTrack): Track {
  const trackType = serverTrack.type as TrackType
  const clips = (serverTrack.clips ?? [])
    .map((c) => serverClipToStore(c, trackType))
    .filter((c): c is Clip => c != null)
  return {
    id: serverTrack.id,
    type: trackType,
    name: `${trackType[0].toUpperCase()}${trackType.slice(1)} ${serverTrack.position + 1}`,
    muted: serverTrack.muted,
    hidden: serverTrack.hidden,
    clips,
  }
}

export type HydrationData = {
  compositionId: string
  fileNodeId: string
  fps: number
  durationInFrames: number
  aspectRatio: AspectRatio
  width: number
  height: number
  tracks: Track[]
}

export function serverToHydration(res: LoadCompositionResponse): HydrationData {
  return {
    compositionId: res.composition.id,
    fileNodeId: res.composition.fileNodeId,
    fps: res.composition.fps,
    durationInFrames: res.composition.durationInFrames,
    aspectRatio: res.composition.aspectRatio as AspectRatio,
    width: res.composition.width,
    height: res.composition.height,
    tracks: res.tracks.map(serverTrackToStore),
  }
}

// ============================================================================
// Store -> Server transforms (clip properties extraction)
// ============================================================================

const STRUCTURAL_KEYS = new Set([
  'id', 'trackId', 'type', 'startFrame', 'endFrame',
  'sourceStartFrame', 'sourceDurationInFrames',
])

function extractProperties(clip: Clip): Record<string, unknown> {
  if (clip.type === 'caption') {
    return {
      text: clip.captions.text,
      words: clip.captions.words,
      ...clip.properties,
    }
  }
  const props: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(clip)) {
    if (!STRUCTURAL_KEYS.has(key)) {
      props[key] = value
    }
  }
  return props
}

// ============================================================================
// State diffing -> BatchOperation[]
// ============================================================================

function isEqualValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (a === null || b === null || typeof a !== typeof b) return false
  if (typeof a === 'object') {
    return JSON.stringify(a) === JSON.stringify(b)
  }
  return false
}

type DiffableState = {
  compositionId: string
  fps: number
  durationInFrames: number
  aspectRatio: AspectRatio
  width: number
  height: number
  tracks: Track[]
}

export function diffableSnapshotsEqual(
  a: DiffableState,
  b: DiffableState,
): boolean {
  return (
    a.compositionId === b.compositionId &&
    a.fps === b.fps &&
    a.durationInFrames === b.durationInFrames &&
    a.aspectRatio === b.aspectRatio &&
    a.width === b.width &&
    a.height === b.height &&
    isEqualValue(a.tracks, b.tracks)
  )
}

export function diffStateToBatchOps(
  prev: DiffableState,
  next: DiffableState,
): BatchOperation[] {
  const ops: BatchOperation[] = []

  // -- Composition-level changes ------------------------------------------
  const compositionPatch: Record<string, unknown> = {}
  if (prev.fps !== next.fps) compositionPatch.fps = next.fps
  if (prev.durationInFrames !== next.durationInFrames)
    compositionPatch.durationInFrames = next.durationInFrames
  if (prev.aspectRatio !== next.aspectRatio)
    compositionPatch.aspectRatio = next.aspectRatio
  if (prev.width !== next.width) compositionPatch.width = next.width
  if (prev.height !== next.height) compositionPatch.height = next.height

  if (Object.keys(compositionPatch).length > 0) {
    ops.push({
      op: 'update_composition',
      compositionId: next.compositionId,
      patch: compositionPatch,
    })
  }

  // -- Build global clip maps to detect cross-track moves -----------------
  const prevAllClips = new Map<string, { clip: Clip; trackId: string }>()
  const nextAllClips = new Map<string, { clip: Clip; trackId: string }>()
  for (const t of prev.tracks) for (const c of t.clips) prevAllClips.set(c.id, { clip: c, trackId: t.id })
  for (const t of next.tracks) for (const c of t.clips) nextAllClips.set(c.id, { clip: c, trackId: t.id })

  const movedClipIds = new Set<string>()
  for (const [clipId, nextInfo] of nextAllClips) {
    const prevInfo = prevAllClips.get(clipId)
    if (prevInfo && prevInfo.trackId !== nextInfo.trackId) {
      movedClipIds.add(clipId)
    }
  }

  // -- Track-level diffs --------------------------------------------------
  const prevTrackMap = new Map(prev.tracks.map((t) => [t.id, t]))
  const nextTrackMap = new Map(next.tracks.map((t) => [t.id, t]))

  // Removed tracks
  for (const [id] of prevTrackMap) {
    if (!nextTrackMap.has(id)) {
      ops.push({ op: 'remove_track', trackId: id })
    }
  }

  // Added tracks and their truly-new clips (skip moved clips)
  for (const [id, track] of nextTrackMap) {
    if (!prevTrackMap.has(id)) {
      ops.push({
        op: 'add_track',
        data: {
          id: track.id,
          type: track.type,
          name: track.name,
          position: next.tracks.indexOf(track),
          muted: track.muted,
          hidden: track.hidden,
        },
      })
      for (const clip of track.clips) {
        if (movedClipIds.has(clip.id)) continue
        ops.push({
          op: 'add_clip',
          data: {
            id: clip.id,
            trackId: track.id,
            type: clip.type,
            startFrame: clip.startFrame,
            endFrame: clip.endFrame,
            sourceStartFrame: clip.sourceStartFrame,
            sourceDurationInFrames: clip.sourceDurationInFrames,
            properties: extractProperties(clip),
          },
        })
      }
      continue
    }

    // Track exists in both - check for updates
    const prevTrack = prevTrackMap.get(id)!
    const trackPatch: Record<string, unknown> = {}
    const nextPosition = next.tracks.indexOf(track)
    const prevPosition = prev.tracks.indexOf(prevTrack)
    if (nextPosition !== prevPosition) trackPatch.position = nextPosition
    if (prevTrack.muted !== track.muted) trackPatch.muted = track.muted
    if (prevTrack.hidden !== track.hidden) trackPatch.hidden = track.hidden
    if (prevTrack.name !== track.name) trackPatch.name = track.name

    if (Object.keys(trackPatch).length > 0) {
      ops.push({ op: 'update_track', trackId: id, patch: trackPatch })
    }

    // Diff clips within this track
    const prevClipMap = new Map(prevTrack.clips.map((c) => [c.id, c]))
    const nextClipMap = new Map(track.clips.map((c) => [c.id, c]))

    // Removed clips (skip moved clips — they'll be handled as update_clip)
    for (const [clipId] of prevClipMap) {
      if (!nextClipMap.has(clipId) && !movedClipIds.has(clipId)) {
        ops.push({ op: 'remove_clip', clipId })
      }
    }

    // Added clips (skip moved clips)
    for (const [clipId, clip] of nextClipMap) {
      if (!prevClipMap.has(clipId)) {
        if (movedClipIds.has(clipId)) continue
        ops.push({
          op: 'add_clip',
          data: {
            id: clip.id,
            trackId: track.id,
            type: clip.type,
            startFrame: clip.startFrame,
            endFrame: clip.endFrame,
            sourceStartFrame: clip.sourceStartFrame,
            sourceDurationInFrames: clip.sourceDurationInFrames,
            properties: extractProperties(clip),
          },
        })
        continue
      }

      // Clip exists in both - check for updates
      const prevClip = prevClipMap.get(clipId)!
      const clipPatch: Record<string, unknown> = {}
      if (prevClip.trackId !== clip.trackId) clipPatch.trackId = clip.trackId
      if (prevClip.startFrame !== clip.startFrame)
        clipPatch.startFrame = clip.startFrame
      if (prevClip.endFrame !== clip.endFrame)
        clipPatch.endFrame = clip.endFrame
      if (prevClip.sourceStartFrame !== clip.sourceStartFrame)
        clipPatch.sourceStartFrame = clip.sourceStartFrame
      if (prevClip.sourceDurationInFrames !== clip.sourceDurationInFrames)
        clipPatch.sourceDurationInFrames = clip.sourceDurationInFrames

      const prevProps = extractProperties(prevClip)
      const nextProps = extractProperties(clip)
      const propsPatch: Record<string, unknown> = {}
      for (const key of Object.keys(nextProps)) {
        if (!isEqualValue(prevProps[key], nextProps[key])) {
          propsPatch[key] = nextProps[key]
        }
      }
      if (Object.keys(propsPatch).length > 0) {
        clipPatch.properties = propsPatch
      }

      if (Object.keys(clipPatch).length > 0) {
        ops.push({ op: 'update_clip', clipId, patch: clipPatch })
      }
    }
  }

  // -- Emit update_clip for cross-track moves -----------------------------
  for (const clipId of movedClipIds) {
    const prevInfo = prevAllClips.get(clipId)!
    const nextInfo = nextAllClips.get(clipId)!
    const prevClip = prevInfo.clip
    const nextClip = nextInfo.clip

    const clipPatch: Record<string, unknown> = { trackId: nextInfo.trackId }
    if (prevClip.startFrame !== nextClip.startFrame)
      clipPatch.startFrame = nextClip.startFrame
    if (prevClip.endFrame !== nextClip.endFrame)
      clipPatch.endFrame = nextClip.endFrame
    if (prevClip.sourceStartFrame !== nextClip.sourceStartFrame)
      clipPatch.sourceStartFrame = nextClip.sourceStartFrame
    if (prevClip.sourceDurationInFrames !== nextClip.sourceDurationInFrames)
      clipPatch.sourceDurationInFrames = nextClip.sourceDurationInFrames

    const prevProps = extractProperties(prevClip)
    const nextProps = extractProperties(nextClip)
    const propsPatch: Record<string, unknown> = {}
    for (const key of Object.keys(nextProps)) {
      if (!isEqualValue(prevProps[key], nextProps[key])) {
        propsPatch[key] = nextProps[key]
      }
    }
    if (Object.keys(propsPatch).length > 0) {
      clipPatch.properties = propsPatch
    }

    ops.push({ op: 'update_clip', clipId, patch: clipPatch })
  }

  return ops
}
