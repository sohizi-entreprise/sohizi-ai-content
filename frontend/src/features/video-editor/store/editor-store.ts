import { create, useStore } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { temporal } from 'zundo'
import { makeId } from '../utils/ids'
import { ASPECT_RATIO_DIMENSIONS } from './types'
import type { StateCreator } from 'zustand'
import type { TemporalState } from 'zundo'
import type {
  AspectRatio,
  AudioClip,
  Clip,
  ImageClip,
  ProjectState,
  TextClip,
  Track,
  TrackType,
  VideoClip,
} from './types'

type ResizeSide = 'left' | 'right'

type EditorState = ProjectState

interface EditorActions {
  addTrack: (type: TrackType, name?: string) => string
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
  }) => string
  addAudioClip: (params: {
    trackId?: string
    url: string
    fileName: string
    durationInFrames: number
    startFrame?: number
  }) => string
  addTextClip: (params: {
    trackId?: string
    text: string
    durationInFrames: number
    startFrame?: number
  }) => string
  addImageClip: (params: {
    trackId?: string
    url: string
    fileName: string
    durationInFrames: number
    width?: number
    height?: number
    startFrame?: number
  }) => string

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
  setZoomScale: (zoomScale: number) => void
  setViewport: (startSec: number, endSec: number) => void
  setDurationInFrames: (frames: number) => void
}

const DEFAULT_FPS = 30
const DEFAULT_ASPECT: AspectRatio = '16:9'

const defaultDims = ASPECT_RATIO_DIMENSIONS[DEFAULT_ASPECT]

const initialState: EditorState = {
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
    id: makeId(`track_${type}`),
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

function recomputeDuration(state: EditorState): void {
  const minDuration = Math.max(state.fps * 10, 1)
  let maxEnd = 0
  for (const track of state.tracks) {
    for (const clip of track.clips) {
      if (clip.endFrame > maxEnd) maxEnd = clip.endFrame
    }
  }
  state.durationInFrames = Math.max(minDuration, maxEnd + state.fps * 2)
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
  [['zustand/immer', never]],
  [],
  EditorState & EditorActions
> = (set) => ({
  ...initialState,

  addTrack: (type, name) => {
    const id = makeId(`track_${type}`)
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
    const id = makeId('clip_video')
    set((state) => {
      const track = trackId
        ? (state.tracks.find((t) => t.id === trackId && t.type === 'video') ??
          findOrCreateTrack(state, 'video'))
        : findOrCreateTrack(state, 'video')

      const start = startFrame ?? nextFreeStart(track)
      const clip: VideoClip = {
        id,
        trackId: track.id,
        type: 'video',
        startFrame: start,
        endFrame: start + Math.max(1, durationInFrames),
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
      }
      track.clips.push(clip)
      recomputeDuration(state)
    })
    return id
  },

  addAudioClip: ({ trackId, url, fileName, durationInFrames, startFrame }) => {
    const id = makeId('clip_audio')
    set((state) => {
      const track = trackId
        ? (state.tracks.find((t) => t.id === trackId && t.type === 'audio') ??
          findOrCreateTrack(state, 'audio'))
        : findOrCreateTrack(state, 'audio')

      const start = startFrame ?? nextFreeStart(track)
      const clip: AudioClip = {
        id,
        trackId: track.id,
        type: 'audio',
        startFrame: start,
        endFrame: start + Math.max(1, durationInFrames),
        sourceStartFrame: 0,
        sourceDurationInFrames: Math.max(1, durationInFrames),
        url,
        fileName,
        volume: 1,
        speed: 1,
      }
      track.clips.push(clip)
      recomputeDuration(state)
    })
    return id
  },

  addTextClip: ({ trackId, text, durationInFrames, startFrame }) => {
    const id = makeId('clip_text')
    set((state) => {
      const track = trackId
        ? (state.tracks.find((t) => t.id === trackId && t.type === 'text') ??
          findOrCreateTrack(state, 'text'))
        : findOrCreateTrack(state, 'text')

      const start = startFrame ?? state.currentFrame
      const clip: TextClip = {
        id,
        trackId: track.id,
        type: 'text',
        startFrame: start,
        endFrame: start + Math.max(1, durationInFrames),
        sourceStartFrame: 0,
        sourceDurationInFrames: Math.max(1, durationInFrames),
        text,
        fontSize: 64,
        color: '#ffffff',
        fontFamily: 'Inter',
        fontWeight: 'bold',
        align: 'center',
        opacity: 1,
        xRatio: 0.5,
        yRatio: 0.85,
        widthRatio: 0.7,
        heightRatio: 0.18,
      }
      track.clips.push(clip)
      recomputeDuration(state)
    })
    return id
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
    const id = makeId('clip_image')
    set((state) => {
      const track = trackId
        ? (state.tracks.find((t) => t.id === trackId && t.type === 'image') ??
          findOrCreateTrack(state, 'image'))
        : findOrCreateTrack(state, 'image')

      const start = startFrame ?? nextFreeStart(track)
      const clip: ImageClip = {
        id,
        trackId: track.id,
        type: 'image',
        startFrame: start,
        endFrame: start + Math.max(1, durationInFrames),
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
        xRatio: 0.5,
        yRatio: 0.5,
        widthRatio: 1,
        heightRatio: 1,
      }
      track.clips.push(clip)
      recomputeDuration(state)
    })
    return id
  },

  updateClip: (clipId, patch) => {
    set((state) => {
      const found = findClip(state.tracks, clipId)
      if (!found) return
      const { clip } = found
      const { id: _id, type: _type, trackId: _trackId, ...safe } = patch as {
        id?: string
        type?: string
        trackId?: string
        [k: string]: unknown
      }
      void _id
      void _type
      void _trackId
      Object.assign(clip, safe)
    })
  },

  moveClip: (clipId, deltaFrames) => {
    set((state) => {
      const found = findClip(state.tracks, clipId)
      if (!found) return
      const { clip } = found
      const length = clip.endFrame - clip.startFrame
      const newStart = Math.max(0, clip.startFrame + deltaFrames)
      clip.startFrame = newStart
      clip.endFrame = newStart + length
      recomputeDuration(state)
    })
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

      sourceTrack.clips.splice(clipIndex, 1)
      const length = clip.endFrame - clip.startFrame
      const newStart = Math.max(0, Math.floor(newStartFrame))
      clip.startFrame = newStart
      clip.endFrame = newStart + length
      clip.trackId = target.id
      target.clips.push(clip)
      pruneEmpty(state)
      recomputeDuration(state)
      ok = true
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
      const newStart = Math.max(0, Math.floor(newStartFrame))
      clip.startFrame = newStart
      clip.endFrame = newStart + length

      const newTrack: Track = {
        id: makeId(`track_${clip.type}`),
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
      const { clip } = found

      if (side === 'left') {
        const clamped = Math.max(0, Math.min(newFrame, clip.endFrame - 1))
        const delta = clamped - clip.startFrame
        clip.startFrame = clamped
        if (clip.type === 'video' || clip.type === 'audio') {
          clip.sourceStartFrame = Math.max(0, clip.sourceStartFrame + delta)
        }
      } else {
        const clamped = Math.max(clip.startFrame + 1, newFrame)
        clip.endFrame = clamped
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
      const rightId = makeId(`clip_${clip.type}`)

      const leftClip: Clip = {
        ...clip,
        endFrame: playhead,
      } as Clip

      let rightClip: Clip
      if (clip.type === 'video') {
        rightClip = {
          ...clip,
          id: rightId,
          startFrame: playhead,
          endFrame: clip.endFrame,
          sourceStartFrame: clip.sourceStartFrame + leftDuration,
        }
      } else if (clip.type === 'audio') {
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
      state.durationInFrames = Math.max(1, Math.floor(frames))
    })
  },
})

export const useVideoEditorStore = create<EditorState & EditorActions>()(
  temporal(immer(creator), {
    partialize: (state) => {
      const { currentFrame, viewport, isPlaying, selection, ...rest } = state
      void currentFrame
      void viewport
      void isPlaying
      void selection
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
