import { create, useStore } from "zustand"
import { immer } from "zustand/middleware/immer"
import { temporal } from "zundo"
import { v4 as uuidv4 } from "uuid"
import { toast } from "sonner"
import {
  TIMELINE_CAP_MESSAGE,
  clampClipEnd,
  clampClipMove,
  clampTimelineDuration,
  maxTimelineFrames,
} from "../utils/timeline-limit"
import {
  isTrackType,
  scaleClipFramesForFps,
  serverClipToStore,
} from "../transforms"
import { ASPECT_RATIO_DIMENSIONS } from "./types"
import type { HydrationData } from "../transforms"
import type { VideoEditorChange } from "../requests"
import type { StateCreator } from "zustand"
import type { TemporalState } from "zundo"
import type {
  AspectRatio,
  AudioClip,
  Clip,
  FontWeight,
  ImageClip,
  ProjectState,
  TextAlign,
  TextClip,
  Track,
  TrackType,
  VideoClip,
} from "./types"

type ResizeSide = "left" | "right"

type EditorState = ProjectState & {
  compositionId: string | null
  fileNodeId: string | null
  projectId: string | null
  isHydrated: boolean
  serverSyncVersion: number
}

interface EditorActions {
  hydrate: (data: HydrationData & { projectId: string }) => void
  applyServerChange: (change: VideoEditorChange) => void
  resetStore: () => void
  addTrack: (type: TrackType, name?: string) => string
  insertTrackAt: (type: TrackType, insertIndex: number, name?: string) => string
  removeTrack: (trackId: string) => void
  toggleTrackMuted: (trackId: string) => void
  toggleTrackHidden: (trackId: string) => void
  reorderTracks: (sourceIndex: number, destinationIndex: number) => void
  renameTrack: (trackId: string, name: string) => void
  pruneEmptyTracks: () => void

  addVideoClip: (params: {
    trackId?: string
    url: string
    fileName: string
    durationInFrames: number
    width?: number
    height?: number
    startFrame?: number
  }) => string | null
  addAudioClip: (params: {
    trackId?: string
    url: string
    fileName: string
    durationInFrames: number
    startFrame?: number
  }) => string | null
  addTextClip: (params: {
    trackId?: string
    text: string
    durationInFrames: number
    startFrame?: number
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
  }) => string | null
  addImageClip: (params: {
    trackId?: string
    url: string
    fileName: string
    durationInFrames: number
    width?: number
    height?: number
    startFrame?: number
  }) => string | null

  updateClip: (clipId: string, patch: Partial<Clip>) => void

  moveClip: (clipId: string, deltaFrames: number) => void
  moveClipToTrack: (
    clipId: string,
    targetTrackId: string,
    newStartFrame: number,
  ) => boolean
  moveClipToNewTrack: (
    clipId: string,
    insertIndex: number,
    newStartFrame: number,
  ) => string | null
  resizeClip: (clipId: string, side: ResizeSide, newFrame: number) => void
  splitClipAtPlayhead: (clipId: string) => void
  deleteClip: (clipId: string) => void
  selectClip: (clipId: string | null, additive?: boolean) => void
  clearSelection: () => void

  setCurrentFrame: (frame: number) => void
  seekToFrame: (frame: number) => void
  setIsPlaying: (isPlaying: boolean) => void

  setAspectRatio: (ratio: AspectRatio) => void
  setFps: (fps: number) => void
  setZoomScale: (zoomScale: number) => void
  setViewport: (startSec: number, endSec: number) => void
  setDurationInFrames: (frames: number) => void
}

const DEFAULT_FPS = 30
const DEFAULT_ASPECT: AspectRatio = "16:9"

const defaultDims = ASPECT_RATIO_DIMENSIONS[DEFAULT_ASPECT]

const initialState: EditorState = {
  compositionId: null,
  fileNodeId: null,
  projectId: null,
  isHydrated: false,
  serverSyncVersion: 0,
  fps: DEFAULT_FPS,
  durationInFrames: DEFAULT_FPS * 30,
  currentFrame: 0,
  aspectRatio: DEFAULT_ASPECT,
  width: defaultDims.width,
  height: defaultDims.height,
  zoomScale: 1,
  viewport: { startSec: 0, endSec: 30 },
  tracks: [],
  selection: { clipIds: [] },
  isPlaying: false,
}

function findClip(
  tracks: Array<Track>,
  clipId: string,
): { track: Track; clip: Clip; trackIndex: number; clipIndex: number } | null {
  for (let t = 0; t < tracks.length; t += 1) {
    const track = tracks[t]
    const clipIndex = track.clips.findIndex((c) => c.id === clipId)
    if (clipIndex >= 0) {
      return { track, clip: track.clips[clipIndex], trackIndex: t, clipIndex }
    }
  }
  return null
}

function findOrCreateTrack(state: EditorState, type: TrackType): Track {
  const existing = state.tracks.find((t) => t.type === type)
  if (existing) return existing
  const newTrack: Track = {
    id: uuidv4(),
    type,
    name: `${type[0].toUpperCase()}${type.slice(1)} ${state.tracks.length + 1}`,
    muted: false,
    hidden: false,
    clips: [],
  }
  state.tracks.push(newTrack)
  return newTrack
}

function nextFreeStart(track: Track): number {
  if (track.clips.length === 0) return 0
  return Math.max(...track.clips.map((c) => c.endFrame))
}

export function getClipResizeBounds(
  track: Readonly<{
    clips: ReadonlyArray<{ id: string; startFrame: number; endFrame: number }>
  }>,
  clip: { id: string; startFrame: number; endFrame: number },
  fps: number,
): { minStartFrame: number; maxEndFrame: number } {
  let minStartFrame = 0
  let maxEndFrame = maxTimelineFrames(fps)

  for (const other of track.clips) {
    if (other.id === clip.id) continue
    if (other.endFrame <= clip.startFrame) {
      if (other.endFrame > minStartFrame) {
        minStartFrame = other.endFrame
      }
    } else if (other.startFrame >= clip.endFrame) {
      if (other.startFrame < maxEndFrame) {
        maxEndFrame = other.startFrame
      }
    }
  }

  return { minStartFrame, maxEndFrame }
}

export function hasTrackClipOverlap(
  track: Readonly<{
    clips: ReadonlyArray<{ id: string; startFrame: number; endFrame: number }>
  }>,
  startFrame: number,
  endFrame: number,
  excludeClipId?: string,
): boolean {
  for (const other of track.clips) {
    if (other.id === excludeClipId) continue
    if (startFrame < other.endFrame && endFrame > other.startFrame) {
      return true
    }
  }
  return false
}

export function findNonOverlappingSlot(
  track: Readonly<{
    clips: ReadonlyArray<{ id: string; startFrame: number; endFrame: number }>
  }>,
  requestedStartFrame: number,
  length: number,
  fps: number,
  excludeClipId?: string,
): { startFrame: number; endFrame: number } | null {
  const maxFrame = maxTimelineFrames(fps)
  const span = Math.max(1, Math.floor(length))
  if (span > maxFrame) return null

  const clampedMove = clampClipMove(requestedStartFrame, span, fps)
  const siblings = track.clips
    .filter((c) => c.id !== excludeClipId)
    .slice()
    .sort((a, b) => a.startFrame - b.startFrame)

  if (siblings.length === 0) {
    return clampedMove
  }

  const gaps: Array<{ start: number; end: number }> = []
  let cursor = 0
  for (const sib of siblings) {
    if (sib.startFrame > cursor) {
      gaps.push({ start: cursor, end: Math.min(maxFrame, sib.startFrame) })
    }
    if (sib.endFrame > cursor) {
      cursor = sib.endFrame
    }
  }
  if (cursor < maxFrame) {
    gaps.push({ start: cursor, end: maxFrame })
  }

  let bestStart: number | null = null
  let bestDist = Infinity

  for (const gap of gaps) {
    const gapLen = gap.end - gap.start
    if (gapLen < span) continue
    const candidateStart = Math.max(
      gap.start,
      Math.min(clampedMove.startFrame, gap.end - span),
    )
    const dist = Math.abs(candidateStart - clampedMove.startFrame)
    if (dist < bestDist) {
      bestDist = dist
      bestStart = candidateStart
    }
  }

  if (bestStart === null) return null
  return { startFrame: bestStart, endFrame: bestStart + span }
}

function scaleFrame(frame: number, scale: number): number {
  return Math.max(0, Math.round(frame * scale))
}

function rescaleTracksForFps(tracks: Array<Track>, scale: number): void {
  for (const track of tracks) {
    for (const clip of track.clips) {
      const scaled = scaleClipFramesForFps(clip, scale)
      clip.startFrame = scaled.startFrame
      clip.endFrame = scaled.endFrame
      clip.sourceStartFrame = scaled.sourceStartFrame
      clip.sourceDurationInFrames = scaled.sourceDurationInFrames
    }
  }
}

function notifyTimelineCap(): void {
  toast.error(TIMELINE_CAP_MESSAGE, { id: "timeline-cap" })
}

function finishAddedClip(
  tracks: Array<Track>,
  id: string,
  requestedLength: number,
): string | null {
  const found = findClip(tracks, id)
  if (!found) {
    notifyTimelineCap()
    return null
  }
  const placedLength = found.clip.endFrame - found.clip.startFrame
  if (placedLength < requestedLength) notifyTimelineCap()
  return id
}

function recomputeDuration(state: EditorState): void {
  const minDuration = Math.max(state.fps * 10, 1)
  let maxEnd = 0
  for (const track of state.tracks) {
    for (const clip of track.clips) {
      if (clip.endFrame > maxEnd) maxEnd = clip.endFrame
    }
  }
  state.durationInFrames = clampTimelineDuration(
    Math.max(minDuration, maxEnd + state.fps * 2),
    state.fps,
  )
}

/** Drop clips that start past the cap and trim any that hang over it. */
function trimClipsToTimeline(state: EditorState): boolean {
  const maxFrame = maxTimelineFrames(state.fps)
  let trimmed = false
  for (const track of state.tracks) {
    const kept: Array<Clip> = []
    for (const clip of track.clips) {
      if (clip.startFrame >= maxFrame) {
        trimmed = true
        continue
      }
      if (clip.endFrame > maxFrame) {
        clip.endFrame = maxFrame
        trimmed = true
      }
      if (clip.endFrame <= clip.startFrame) {
        trimmed = true
        continue
      }
      kept.push(clip)
    }
    track.clips = kept
  }
  if (trimmed) pruneEmpty(state)
  return trimmed
}

function takeClipPlacement(
  state: EditorState,
  startFrame: number | undefined,
  durationInFrames: number,
  trackForStart: Track | undefined,
): { startFrame: number; endFrame: number; trimmed: boolean } | null {
  const length = Math.max(1, Math.floor(durationInFrames))
  const fallbackStart = trackForStart ? nextFreeStart(trackForStart) : 0
  const start = Math.max(0, Math.floor(startFrame ?? fallbackStart))
  const placed = clampClipEnd(start, start + length, state.fps)
  if (!placed) return null

  if (!trackForStart || trackForStart.clips.length === 0) {
    return {
      startFrame: placed.startFrame,
      endFrame: placed.endFrame,
      trimmed: placed.endFrame < start + length,
    }
  }

  const placedLength = placed.endFrame - placed.startFrame
  if (!hasTrackClipOverlap(trackForStart, placed.startFrame, placed.endFrame)) {
    return {
      startFrame: placed.startFrame,
      endFrame: placed.endFrame,
      trimmed: placedLength < length,
    }
  }

  const slot = findNonOverlappingSlot(
    trackForStart,
    placed.startFrame,
    placedLength,
    state.fps,
  )
  if (slot) {
    return {
      startFrame: slot.startFrame,
      endFrame: slot.endFrame,
      trimmed: slot.endFrame - slot.startFrame < length,
    }
  }

  const tailStart = nextFreeStart(trackForStart)
  const tailPlaced = clampClipEnd(tailStart, tailStart + length, state.fps)
  if (!tailPlaced) return null
  return {
    startFrame: tailPlaced.startFrame,
    endFrame: tailPlaced.endFrame,
    trimmed: tailPlaced.endFrame - tailPlaced.startFrame < length,
  }
}

function pruneEmpty(state: EditorState): void {
  state.tracks = state.tracks.filter((t) => t.clips.length > 0)
  state.selection.clipIds = state.selection.clipIds.filter((id) =>
    state.tracks.some((t) => t.clips.some((c) => c.id === id)),
  )
}

function nextTrackName(state: EditorState, type: TrackType): string {
  const sameType = state.tracks.filter((t) => t.type === type)
  return `${type[0].toUpperCase()}${type.slice(1)} ${sameType.length + 1}`
}

const creator: StateCreator<
  EditorState & EditorActions,
  [["zustand/immer", never]],
  [],
  EditorState & EditorActions
> = (set, get) => ({
  ...initialState,

  hydrate: (data) => {
    set((state) => {
      state.compositionId = data.compositionId
      state.fileNodeId = data.fileNodeId
      state.projectId = data.projectId
      state.fps = data.fps
      state.durationInFrames = clampTimelineDuration(
        data.durationInFrames,
        data.fps,
      )
      state.aspectRatio = data.aspectRatio
      state.width = data.width
      state.height = data.height
      state.tracks = data.tracks
      trimClipsToTimeline(state)
      state.currentFrame = 0
      state.selection = { clipIds: [] }
      state.isPlaying = false
      state.isHydrated = true
    })
  },

  applyServerChange: (change) => {
    set((state) => {
      if (!state.isHydrated || !state.compositionId) return

      switch (change.type) {
        case "update_composition": {
          const { composition } = change
          if (composition.id !== state.compositionId) return
          if (
            composition.fps !== state.fps &&
            state.fps > 0 &&
            composition.fps > 0
          ) {
            rescaleTracksForFps(state.tracks, composition.fps / state.fps)
          }
          state.fps = composition.fps
          state.aspectRatio = composition.aspectRatio as AspectRatio
          state.width = composition.width
          state.height = composition.height
          state.durationInFrames = clampTimelineDuration(
            composition.durationInFrames,
            composition.fps,
          )
          trimClipsToTimeline(state)
          state.currentFrame = Math.min(
            state.currentFrame,
            Math.max(0, state.durationInFrames - 1),
          )
          state.serverSyncVersion += 1
          break
        }
        case "add_track": {
          const { track: serverTrack, name } = change
          if (serverTrack.compositionId !== state.compositionId) return
          if (!isTrackType(serverTrack.type)) return
          const trackType = serverTrack.type
          const defaultName = `${trackType[0].toUpperCase()}${trackType.slice(1)} ${serverTrack.position + 1}`
          const existingIndex = state.tracks.findIndex(
            (t) => t.id === serverTrack.id,
          )
          if (existingIndex >= 0) {
            const existing = state.tracks[existingIndex]
            existing.type = trackType
            if (name) existing.name = name
            existing.muted = serverTrack.muted
            existing.hidden = serverTrack.hidden
          } else {
            const newTrack: Track = {
              id: serverTrack.id,
              type: trackType,
              name: name || defaultName,
              muted: serverTrack.muted,
              hidden: serverTrack.hidden,
              clips: [],
            }
            const insertIdx = Math.max(
              0,
              Math.min(serverTrack.position, state.tracks.length),
            )
            state.tracks.splice(insertIdx, 0, newTrack)
          }
          state.serverSyncVersion += 1
          break
        }
        case "update_track": {
          const { track: serverTrack, name } = change
          if (serverTrack.compositionId !== state.compositionId) return
          const currentIndex = state.tracks.findIndex(
            (t) => t.id === serverTrack.id,
          )
          if (currentIndex === -1) return
          const track = state.tracks[currentIndex]
          track.muted = serverTrack.muted
          track.hidden = serverTrack.hidden
          if (name !== undefined) {
            track.name = name
          }
          const targetIndex = Math.max(
            0,
            Math.min(serverTrack.position, state.tracks.length - 1),
          )
          if (targetIndex !== currentIndex) {
            const [moved] = state.tracks.splice(currentIndex, 1)
            state.tracks.splice(targetIndex, 0, moved)
          }
          state.serverSyncVersion += 1
          break
        }
        case "remove_track": {
          const prevLen = state.tracks.length
          state.tracks = state.tracks.filter((t) => t.id !== change.trackId)
          if (state.tracks.length === prevLen) return
          state.selection.clipIds = state.selection.clipIds.filter((id) =>
            state.tracks.some((t) => t.clips.some((c) => c.id === id)),
          )
          recomputeDuration(state)
          state.serverSyncVersion += 1
          break
        }
        case "add_clip": {
          const { clip: serverClip } = change
          if (serverClip.compositionId !== state.compositionId) return
          const track = state.tracks.find((t) => t.id === serverClip.trackId)
          if (!track) return
          const clipType = isTrackType(serverClip.type)
            ? serverClip.type
            : track.type
          const storeClip = serverClipToStore(serverClip, clipType)
          const existingIdx = track.clips.findIndex(
            (c) => c.id === storeClip.id,
          )
          if (existingIdx >= 0) {
            track.clips[existingIdx] = storeClip
          } else {
            track.clips.push(storeClip)
          }
          trimClipsToTimeline(state)
          recomputeDuration(state)
          state.serverSyncVersion += 1
          break
        }
        case "update_clip": {
          const { clip: serverClip } = change
          if (serverClip.compositionId !== state.compositionId) return
          const targetTrack = state.tracks.find(
            (t) => t.id === serverClip.trackId,
          )
          if (!targetTrack) return
          const clipType = isTrackType(serverClip.type)
            ? serverClip.type
            : targetTrack.type
          const storeClip = serverClipToStore(serverClip, clipType)

          const found = findClip(state.tracks, serverClip.id)
          if (found) {
            if (found.track.id === targetTrack.id) {
              found.track.clips[found.clipIndex] = storeClip
            } else {
              found.track.clips.splice(found.clipIndex, 1)
              targetTrack.clips.push(storeClip)
            }
          } else {
            targetTrack.clips.push(storeClip)
          }
          trimClipsToTimeline(state)
          recomputeDuration(state)
          state.serverSyncVersion += 1
          break
        }
        case "remove_clip": {
          let removed = false
          for (const track of state.tracks) {
            const idx = track.clips.findIndex((c) => c.id === change.clipId)
            if (idx >= 0) {
              track.clips.splice(idx, 1)
              removed = true
              break
            }
          }
          if (!removed) return
          state.selection.clipIds = state.selection.clipIds.filter(
            (id) => id !== change.clipId,
          )
          recomputeDuration(state)
          state.serverSyncVersion += 1
          break
        }
      }
    })
  },

  resetStore: () => {
    set(() => ({ ...initialState }))
  },

  addTrack: (type, name) => {
    const id = uuidv4()
    set((state) => {
      state.tracks.push({
        id,
        type,
        name:
          name ??
          `${type[0].toUpperCase()}${type.slice(1)} ${state.tracks.length + 1}`,
        muted: false,
        hidden: false,
        clips: [],
      })
    })
    return id
  },

  insertTrackAt: (type, insertIndex, name) => {
    const id = uuidv4()
    set((state) => {
      const clamped = Math.max(0, Math.min(insertIndex, state.tracks.length))
      state.tracks.splice(clamped, 0, {
        id,
        type,
        name:
          name ??
          `${type[0].toUpperCase()}${type.slice(1)} ${state.tracks.length + 1}`,
        muted: false,
        hidden: false,
        clips: [],
      })
    })
    return id
  },

  removeTrack: (trackId) => {
    set((state) => {
      state.tracks = state.tracks.filter((t) => t.id !== trackId)
      state.selection.clipIds = state.selection.clipIds.filter((id) => {
        const exists = state.tracks.some((t) =>
          t.clips.some((c) => c.id === id),
        )
        return exists
      })
      recomputeDuration(state)
    })
  },

  toggleTrackMuted: (trackId) => {
    set((state) => {
      const track = state.tracks.find((t) => t.id === trackId)
      if (track) track.muted = !track.muted
    })
  },

  toggleTrackHidden: (trackId) => {
    set((state) => {
      const track = state.tracks.find((t) => t.id === trackId)
      if (track) track.hidden = !track.hidden
    })
  },

  renameTrack: (trackId, name) => {
    set((state) => {
      const track = state.tracks.find((t) => t.id === trackId)
      if (track) track.name = name
    })
  },

  reorderTracks: (sourceIndex, destinationIndex) => {
    set((state) => {
      if (
        sourceIndex < 0 ||
        destinationIndex < 0 ||
        sourceIndex >= state.tracks.length ||
        destinationIndex >= state.tracks.length
      ) {
        return
      }
      const [moved] = state.tracks.splice(sourceIndex, 1)
      state.tracks.splice(destinationIndex, 0, moved)
    })
  },

  pruneEmptyTracks: () => {
    set((state) => {
      pruneEmpty(state)
    })
  },

  addVideoClip: ({
    trackId,
    url,
    fileName,
    durationInFrames,
    width,
    height,
    startFrame,
  }) => {
    const id = uuidv4()
    const requestedLength = Math.max(1, Math.floor(durationInFrames))
    set((state) => {
      const existing = trackId
        ? state.tracks.find((t) => t.id === trackId && t.type === "video")
        : state.tracks.find((t) => t.type === "video")
      const placement = takeClipPlacement(
        state,
        startFrame,
        durationInFrames,
        existing,
      )
      if (!placement) return
      const track = existing ?? findOrCreateTrack(state, "video")
      const clip: VideoClip = {
        id,
        trackId: track.id,
        type: "video",
        startFrame: placement.startFrame,
        endFrame: placement.endFrame,
        sourceStartFrame: 0,
        sourceDurationInFrames: Math.max(1, durationInFrames),
        url,
        fileName,
        width,
        height,
        volume: 1,
        opacity: 1,
        speed: 1,
        borderRadius: 0,
        blur: 0,
        brightness: 100,
        fit: "contain",
        fadeInFrames: 0,
        fadeOutFrames: 0,
        animationIn: "none",
        animationOut: "none",
        xRatio: 0.5,
        yRatio: 0.5,
        widthRatio: 1,
        heightRatio: 1,
      }
      track.clips.push(clip)
      recomputeDuration(state)
    })
    return finishAddedClip(get().tracks, id, requestedLength)
  },

  addAudioClip: ({ trackId, url, fileName, durationInFrames, startFrame }) => {
    const id = uuidv4()
    const requestedLength = Math.max(1, Math.floor(durationInFrames))
    set((state) => {
      const existing = trackId
        ? state.tracks.find((t) => t.id === trackId && t.type === "audio")
        : state.tracks.find((t) => t.type === "audio")
      const placement = takeClipPlacement(
        state,
        startFrame,
        durationInFrames,
        existing,
      )
      if (!placement) return
      const track = existing ?? findOrCreateTrack(state, "audio")
      const clip: AudioClip = {
        id,
        trackId: track.id,
        type: "audio",
        startFrame: placement.startFrame,
        endFrame: placement.endFrame,
        sourceStartFrame: 0,
        sourceDurationInFrames: Math.max(1, durationInFrames),
        url,
        fileName,
        volume: 1,
        speed: 1,
        fadeInFrames: 0,
        fadeOutFrames: 0,
      }
      track.clips.push(clip)
      recomputeDuration(state)
    })
    return finishAddedClip(get().tracks, id, requestedLength)
  },

  addTextClip: ({
    trackId,
    text,
    durationInFrames,
    startFrame,
    fontSize,
    color,
    fontFamily,
    fontWeight,
    align,
    opacity,
    xRatio,
    yRatio,
    widthRatio,
    heightRatio,
  }) => {
    const id = uuidv4()
    const requestedLength = Math.max(1, Math.floor(durationInFrames))
    set((state) => {
      const existing = trackId
        ? state.tracks.find((t) => t.id === trackId && t.type === "text")
        : state.tracks.find((t) => t.type === "text")
      const placement = takeClipPlacement(
        state,
        startFrame ?? state.currentFrame,
        durationInFrames,
        existing,
      )
      if (!placement) return
      const track = existing ?? findOrCreateTrack(state, "text")
      const clip: TextClip = {
        id,
        trackId: track.id,
        type: "text",
        startFrame: placement.startFrame,
        endFrame: placement.endFrame,
        sourceStartFrame: 0,
        sourceDurationInFrames: Math.max(1, durationInFrames),
        text,
        fontSize: fontSize ?? 64,
        color: color ?? "#ffffff",
        fontFamily: fontFamily ?? "Inter",
        fontWeight: fontWeight ?? "bold",
        align: align ?? "center",
        opacity: opacity ?? 1,
        fadeInFrames: 0,
        fadeOutFrames: 0,
        animationIn: "none",
        animationOut: "none",
        xRatio: xRatio ?? 0.5,
        yRatio: yRatio ?? 0.85,
        widthRatio: widthRatio ?? 0.7,
        heightRatio: heightRatio ?? 0.18,
      }
      track.clips.push(clip)
      recomputeDuration(state)
    })
    return finishAddedClip(get().tracks, id, requestedLength)
  },

  addImageClip: ({
    trackId,
    url,
    fileName,
    durationInFrames,
    width,
    height,
    startFrame,
  }) => {
    const id = uuidv4()
    const requestedLength = Math.max(1, Math.floor(durationInFrames))
    set((state) => {
      const existing = trackId
        ? state.tracks.find((t) => t.id === trackId && t.type === "image")
        : state.tracks.find((t) => t.type === "image")
      const placement = takeClipPlacement(
        state,
        startFrame,
        durationInFrames,
        existing,
      )
      if (!placement) return
      const track = existing ?? findOrCreateTrack(state, "image")
      const clip: ImageClip = {
        id,
        trackId: track.id,
        type: "image",
        startFrame: placement.startFrame,
        endFrame: placement.endFrame,
        sourceStartFrame: 0,
        sourceDurationInFrames: Math.max(1, durationInFrames),
        url,
        fileName,
        width,
        height,
        opacity: 1,
        borderRadius: 0,
        blur: 0,
        brightness: 100,
        fit: "contain",
        fadeInFrames: 0,
        fadeOutFrames: 0,
        animationIn: "none",
        animationOut: "none",
        motionEffect: "none",
        xRatio: 0.5,
        yRatio: 0.5,
        widthRatio: 1,
        heightRatio: 1,
      }
      track.clips.push(clip)
      recomputeDuration(state)
    })
    return finishAddedClip(get().tracks, id, requestedLength)
  },

  updateClip: (clipId, patch) => {
    set((state) => {
      const found = findClip(state.tracks, clipId)
      if (!found) return
      const { track, clip } = found
      const prevClipRange = {
        id: clip.id,
        startFrame: clip.startFrame,
        endFrame: clip.endFrame,
      }
      const {
        id: _id,
        type: _type,
        trackId: _trackId,
        ...safe
      } = patch as {
        id?: string
        type?: string
        trackId?: string
        [k: string]: unknown
      }
      void _id
      void _type
      void _trackId
      Object.assign(clip, safe)
      if ("startFrame" in safe || "endFrame" in safe) {
        const bounds = getClipResizeBounds(track, prevClipRange, state.fps)
        const placed = clampClipEnd(clip.startFrame, clip.endFrame, state.fps)
        if (placed) {
          const clampedStart = Math.max(bounds.minStartFrame, placed.startFrame)
          const clampedEnd = Math.min(
            bounds.maxEndFrame,
            Math.max(clampedStart + 1, placed.endFrame),
          )
          clip.startFrame = clampedStart
          clip.endFrame = clampedEnd
        }
        recomputeDuration(state)
      }
    })
  },

  moveClip: (clipId, deltaFrames) => {
    const before = findClip(get().tracks, clipId)
    set((state) => {
      const found = findClip(state.tracks, clipId)
      if (!found) return
      const { track, clip } = found
      const length = clip.endFrame - clip.startFrame
      const requested = Math.max(0, clip.startFrame + deltaFrames)
      const slot = findNonOverlappingSlot(
        track,
        requested,
        length,
        state.fps,
        clip.id,
      )
      if (!slot) return
      clip.startFrame = slot.startFrame
      clip.endFrame = slot.endFrame
      recomputeDuration(state)
    })
    if (!before) return
    const after = findClip(get().tracks, clipId)
    if (!after) return
    const length = before.clip.endFrame - before.clip.startFrame
    const requested = Math.max(0, before.clip.startFrame + deltaFrames)
    const maxFrame = maxTimelineFrames(get().fps)
    const hitCap =
      requested + length > maxFrame ||
      after.clip.endFrame - after.clip.startFrame !== length
    if (hitCap) notifyTimelineCap()
  },

  moveClipToTrack: (clipId, targetTrackId, newStartFrame) => {
    let ok = false
    set((state) => {
      const found = findClip(state.tracks, clipId)
      if (!found) return
      const { track: sourceTrack, clip, clipIndex } = found
      const target = state.tracks.find((t) => t.id === targetTrackId)
      if (!target) return
      if (target.type !== clip.type) return

      const length = clip.endFrame - clip.startFrame
      const requested = Math.max(0, Math.floor(newStartFrame))
      const slot = findNonOverlappingSlot(
        target,
        requested,
        length,
        state.fps,
        clip.id,
      )
      if (!slot) return

      sourceTrack.clips.splice(clipIndex, 1)
      const maxFrame = maxTimelineFrames(state.fps)
      const capped =
        requested + length > maxFrame ||
        slot.endFrame - slot.startFrame !== length
      clip.startFrame = slot.startFrame
      clip.endFrame = slot.endFrame
      clip.trackId = target.id
      target.clips.push(clip)
      pruneEmpty(state)
      recomputeDuration(state)
      ok = true
      if (capped) notifyTimelineCap()
    })
    return ok
  },

  moveClipToNewTrack: (clipId, insertIndex, newStartFrame) => {
    let createdId: string | null = null
    set((state) => {
      const found = findClip(state.tracks, clipId)
      if (!found) return
      const { track: sourceTrack, clip, clipIndex } = found

      sourceTrack.clips.splice(clipIndex, 1)
      const length = clip.endFrame - clip.startFrame
      const requested = Math.max(0, Math.floor(newStartFrame))
      const placed = clampClipMove(requested, length, state.fps)
      const capped =
        placed.startFrame !== requested ||
        placed.endFrame - placed.startFrame !== length
      clip.startFrame = placed.startFrame
      clip.endFrame = placed.endFrame
      if (capped) notifyTimelineCap()

      const newTrack: Track = {
        id: uuidv4(),
        type: clip.type,
        name: nextTrackName(state, clip.type),
        muted: false,
        hidden: false,
        clips: [clip],
      }
      clip.trackId = newTrack.id

      const clamped = Math.max(0, Math.min(insertIndex, state.tracks.length))
      state.tracks.splice(clamped, 0, newTrack)
      createdId = newTrack.id

      pruneEmpty(state)
      recomputeDuration(state)
    })
    return createdId
  },

  resizeClip: (clipId, side, newFrame) => {
    set((state) => {
      const found = findClip(state.tracks, clipId)
      if (!found) return
      const { track, clip } = found
      const { minStartFrame, maxEndFrame } = getClipResizeBounds(
        track,
        clip,
        state.fps,
      )

      if (side === "left") {
        const clamped = Math.max(
          minStartFrame,
          Math.min(Math.floor(newFrame), clip.endFrame - 1),
        )
        const delta = clamped - clip.startFrame
        clip.startFrame = clamped
        if (clip.type === "video" || clip.type === "audio") {
          clip.sourceStartFrame = Math.max(0, clip.sourceStartFrame + delta)
        }
      } else {
        const requested = Math.max(clip.startFrame + 1, Math.floor(newFrame))
        const placed = clampClipEnd(clip.startFrame, requested, state.fps)
        if (placed) {
          if (requested > maxTimelineFrames(state.fps)) notifyTimelineCap()
          clip.endFrame = Math.min(
            placed.endFrame,
            Math.max(clip.startFrame + 1, maxEndFrame),
          )
        }
      }
      recomputeDuration(state)
    })
  },

  splitClipAtPlayhead: (clipId) => {
    set((state) => {
      const found = findClip(state.tracks, clipId)
      if (!found) return
      const { track, clip, clipIndex } = found
      const playhead = state.currentFrame
      if (playhead <= clip.startFrame || playhead >= clip.endFrame) return

      const leftDuration = playhead - clip.startFrame
      const rightId = uuidv4()

      const leftClip: Clip = {
        ...clip,
        endFrame: playhead,
      }

      let rightClip: Clip
      if (clip.type === "video") {
        rightClip = {
          ...clip,
          id: rightId,
          startFrame: playhead,
          endFrame: clip.endFrame,
          sourceStartFrame: clip.sourceStartFrame + leftDuration,
        }
      } else if (clip.type === "audio") {
        rightClip = {
          ...clip,
          id: rightId,
          startFrame: playhead,
          endFrame: clip.endFrame,
          sourceStartFrame: clip.sourceStartFrame + leftDuration,
        }
      } else {
        rightClip = {
          ...clip,
          id: rightId,
          startFrame: playhead,
          endFrame: clip.endFrame,
        }
      }

      track.clips.splice(clipIndex, 1, leftClip, rightClip)
    })
  },

  deleteClip: (clipId) => {
    set((state) => {
      for (const track of state.tracks) {
        const idx = track.clips.findIndex((c) => c.id === clipId)
        if (idx >= 0) {
          track.clips.splice(idx, 1)
          break
        }
      }
      state.selection.clipIds = state.selection.clipIds.filter(
        (id) => id !== clipId,
      )
      pruneEmpty(state)
      recomputeDuration(state)
    })
  },

  selectClip: (clipId, additive = false) => {
    set((state) => {
      if (clipId === null) {
        state.selection.clipIds = []
        return
      }
      if (additive) {
        const exists = state.selection.clipIds.includes(clipId)
        state.selection.clipIds = exists
          ? state.selection.clipIds.filter((id) => id !== clipId)
          : [...state.selection.clipIds, clipId]
      } else {
        state.selection.clipIds = [clipId]
      }
    })
  },

  clearSelection: () => {
    set((state) => {
      state.selection.clipIds = []
    })
  },

  setCurrentFrame: (frame) => {
    const next = Math.max(0, Math.floor(frame))
    set((state) => {
      if (state.currentFrame === next) return
      state.currentFrame = next
    })
  },

  seekToFrame: (frame) => {
    set((state) => {
      const clamped = Math.max(
        0,
        Math.min(Math.floor(frame), Math.max(0, state.durationInFrames - 1)),
      )
      if (state.currentFrame === clamped) return
      state.currentFrame = clamped
    })
  },

  setIsPlaying: (isPlaying) => {
    set((state) => {
      if (state.isPlaying === isPlaying) return
      state.isPlaying = isPlaying
    })
  },

  setAspectRatio: (ratio) => {
    set((state) => {
      state.aspectRatio = ratio
      const dims = ASPECT_RATIO_DIMENSIONS[ratio]
      state.width = dims.width
      state.height = dims.height
    })
  },

  setFps: (fps) => {
    const next = Math.round(fps)
    if (!Number.isFinite(next) || next < 1 || next > 120) return
    set((state) => {
      if (state.fps === next || state.fps <= 0) return
      const scale = next / state.fps
      state.fps = next

      rescaleTracksForFps(state.tracks, scale)

      trimClipsToTimeline(state)

      let maxEnd = 0
      for (const track of state.tracks) {
        for (const clip of track.clips) {
          if (clip.endFrame > maxEnd) maxEnd = clip.endFrame
        }
      }

      state.durationInFrames = clampTimelineDuration(
        Math.max(1, scaleFrame(state.durationInFrames, scale), maxEnd),
        state.fps,
      )
      state.currentFrame = Math.min(
        scaleFrame(state.currentFrame, scale),
        Math.max(0, state.durationInFrames - 1),
      )
    })
  },

  setZoomScale: (zoomScale) => {
    set((state) => {
      state.zoomScale = Math.max(0.25, Math.min(8, zoomScale))
    })
  },

  setViewport: (startSec, endSec) => {
    const nextStart = Math.max(0, startSec)
    const nextEnd = Math.max(nextStart + 1, endSec)
    set((state) => {
      if (
        state.viewport.startSec === nextStart &&
        state.viewport.endSec === nextEnd
      ) {
        return
      }
      state.viewport.startSec = nextStart
      state.viewport.endSec = nextEnd
    })
  },

  setDurationInFrames: (frames) => {
    set((state) => {
      state.durationInFrames = clampTimelineDuration(frames, state.fps)
    })
  },
})

export const useVideoEditorStore = create<EditorState & EditorActions>()(
  temporal(immer(creator), {
    partialize: (state) => {
      const {
        currentFrame,
        viewport,
        isPlaying,
        selection,
        compositionId,
        fileNodeId,
        projectId,
        isHydrated,
        serverSyncVersion,
        ...rest
      } = state
      void currentFrame
      void viewport
      void isPlaying
      void selection
      void compositionId
      void fileNodeId
      void projectId
      void isHydrated
      void serverSyncVersion
      return rest
    },
    limit: 100,
    equality: (a, b) => a === b,
  }),
)

export const useTemporalStore = <T>(
  selector: (state: TemporalState<EditorState & EditorActions>) => T,
): T =>
  useStore(
    useVideoEditorStore.temporal as unknown as Parameters<typeof useStore>[0],
    selector as unknown as (s: unknown) => T,
  )

export type { EditorState, EditorActions }
