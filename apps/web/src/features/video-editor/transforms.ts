import type {
  AspectRatio,
  AudioClip,
  CaptionClip,
  Clip,
  HtmlClip,
  ImageClip,
  // ServerCaption,
  TextClip,
  Track,
  TrackType,
  VideoClip,
} from "./store/types"
import type {
  BatchOperation,
  LoadCompositionResponse,
  ServerClip,
} from "./requests"

// ============================================================================
// Server -> Store transforms
// ============================================================================

type ServerTrack = LoadCompositionResponse["tracks"][number]

function stringProp(
  props: Record<string, unknown>,
  key: string,
  fallback: string,
): string {
  const value = props[key]
  return typeof value === "string" ? value : fallback
}

function numberProp(
  props: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  const value = props[key]
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function arrayProp<T>(
  props: Record<string, unknown>,
  key: string,
  fallback: Array<T>,
): Array<T> {
  const value = props[key]
  return Array.isArray(value) ? (value as Array<T>) : fallback
}

function objectProp<T extends Record<string, unknown>>(
  props: Record<string, unknown>,
  key: string,
  fallback: T,
): T {
  const value = props[key]
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as T)
    : fallback
}

function serverClipToStore(serverClip: ServerClip, trackType: TrackType): Clip {
  const base = {
    id: serverClip.id,
    trackId: serverClip.trackId,
    startFrame: serverClip.startFrame,
    endFrame: serverClip.endFrame,
    sourceStartFrame: serverClip.sourceStartFrame,
    sourceDurationInFrames: serverClip.sourceDurationInFrames,
  }

  const props = serverClip.properties

  switch (trackType) {
    case "video":
      return {
        ...base,
        type: "video",
        url: stringProp(props, "url", ""),
        fileName: stringProp(props, "fileName", ""),
        width: props.width as number | undefined,
        height: props.height as number | undefined,
        volume: numberProp(props, "volume", 1),
        opacity: numberProp(props, "opacity", 1),
        speed: numberProp(props, "speed", 1),
        borderRadius: numberProp(props, "borderRadius", 0),
        xRatio: numberProp(props, "xRatio", 0.5),
        yRatio: numberProp(props, "yRatio", 0.5),
        widthRatio: numberProp(props, "widthRatio", 1),
        heightRatio: numberProp(props, "heightRatio", 1),
      } satisfies VideoClip
    case "audio":
      return {
        ...base,
        type: "audio",
        url: stringProp(props, "url", ""),
        fileName: stringProp(props, "fileName", ""),
        volume: numberProp(props, "volume", 1),
        speed: numberProp(props, "speed", 1),
      } satisfies AudioClip
    case "text":
      return {
        ...base,
        type: "text",
        text: stringProp(props, "text", ""),
        fontSize: numberProp(props, "fontSize", 64),
        color: stringProp(props, "color", "#ffffff"),
        fontFamily: stringProp(props, "fontFamily", "Inter"),
        fontWeight: stringProp(
          props,
          "fontWeight",
          "bold",
        ) as TextClip["fontWeight"],
        align: stringProp(props, "align", "center") as TextClip["align"],
        opacity: numberProp(props, "opacity", 1),
        xRatio: numberProp(props, "xRatio", 0.5),
        yRatio: numberProp(props, "yRatio", 0.85),
        widthRatio: numberProp(props, "widthRatio", 0.7),
        heightRatio: numberProp(props, "heightRatio", 0.18),
      } satisfies TextClip
    case "image":
      return {
        ...base,
        type: "image",
        url: stringProp(props, "url", ""),
        fileName: stringProp(props, "fileName", ""),
        width: props.width as number | undefined,
        height: props.height as number | undefined,
        opacity: numberProp(props, "opacity", 1),
        borderRadius: numberProp(props, "borderRadius", 0),
        blur: numberProp(props, "blur", 0),
        brightness: numberProp(props, "brightness", 100),
        xRatio: numberProp(props, "xRatio", 0.5),
        yRatio: numberProp(props, "yRatio", 0.5),
        widthRatio: numberProp(props, "widthRatio", 1),
        heightRatio: numberProp(props, "heightRatio", 1),
      } satisfies ImageClip
    case "html":
      return {
        ...base,
        type: "html",
        html: stringProp(props, "html", ""),
        variables: arrayProp(props, "variables", []),
        values: objectProp(props, "values", {}),
        xRatio: numberProp(props, "xRatio", 0.5),
        yRatio: numberProp(props, "yRatio", 0.5),
        widthRatio: numberProp(props, "widthRatio", 1),
        heightRatio: numberProp(props, "heightRatio", 1),
      } satisfies HtmlClip
    case "caption":
      return {
        ...base,
        type: "caption",
        captions: {
          text: stringProp(props, "text", ""),
          words: arrayProp(props, "words", []),
        },
        properties: {
          fontSize: numberProp(props, "fontSize", 48),
          color: stringProp(props, "color", "#ffffff"),
          fontFamily: stringProp(props, "fontFamily", "Inter"),
          fontWeight: stringProp(
            props,
            "fontWeight",
            "bold",
          ) as CaptionClip["properties"]["fontWeight"],
          align: stringProp(
            props,
            "align",
            "center",
          ) as CaptionClip["properties"]["align"],
          opacity: numberProp(props, "opacity", 1),
          xRatio: numberProp(props, "xRatio", 0.5),
          yRatio: numberProp(props, "yRatio", 0.85),
          widthRatio: numberProp(props, "widthRatio", 0.7),
          heightRatio: numberProp(props, "heightRatio", 0.18),
          hightlightColor: props.hightlightColor as string | undefined,
          backgroundColor: props.backgroundColor as string | undefined,
        },
      } satisfies CaptionClip
  }
}

function serverTrackToStore(serverTrack: ServerTrack): Track {
  const trackType = serverTrack.type as TrackType
  const clips = serverTrack.clips.map((c) => serverClipToStore(c, trackType))
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
  tracks: Array<Track>
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
  "id",
  "trackId",
  "type",
  "startFrame",
  "endFrame",
  "sourceStartFrame",
  "sourceDurationInFrames",
])

function extractProperties(clip: Clip): Record<string, unknown> {
  if (clip.type === "caption") {
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
  if (typeof a === "object") {
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
  tracks: Array<Track>
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
): Array<BatchOperation> {
  const ops: Array<BatchOperation> = []

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
      op: "update_composition",
      compositionId: next.compositionId,
      patch: compositionPatch,
    })
  }

  // -- Build global clip maps to detect cross-track moves -----------------
  const prevAllClips = new Map<string, { clip: Clip; trackId: string }>()
  const nextAllClips = new Map<string, { clip: Clip; trackId: string }>()
  for (const t of prev.tracks)
    for (const c of t.clips) prevAllClips.set(c.id, { clip: c, trackId: t.id })
  for (const t of next.tracks)
    for (const c of t.clips) nextAllClips.set(c.id, { clip: c, trackId: t.id })

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
      ops.push({ op: "remove_track", trackId: id })
    }
  }

  // Added tracks and their truly-new clips (skip moved clips)
  for (const [id, track] of nextTrackMap) {
    if (!prevTrackMap.has(id)) {
      ops.push({
        op: "add_track",
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
          op: "add_clip",
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
      ops.push({ op: "update_track", trackId: id, patch: trackPatch })
    }

    // Diff clips within this track
    const prevClipMap = new Map(prevTrack.clips.map((c) => [c.id, c]))
    const nextClipMap = new Map(track.clips.map((c) => [c.id, c]))

    // Removed clips (skip moved clips — they'll be handled as update_clip)
    for (const [clipId] of prevClipMap) {
      if (!nextClipMap.has(clipId) && !movedClipIds.has(clipId)) {
        ops.push({ op: "remove_clip", clipId })
      }
    }

    // Added clips (skip moved clips)
    for (const [clipId, clip] of nextClipMap) {
      if (!prevClipMap.has(clipId)) {
        if (movedClipIds.has(clipId)) continue
        ops.push({
          op: "add_clip",
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
        ops.push({ op: "update_clip", clipId, patch: clipPatch })
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

    ops.push({ op: "update_clip", clipId, patch: clipPatch })
  }

  return ops
}
