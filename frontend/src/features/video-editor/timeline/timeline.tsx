import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Timeline } from '@xzdarcy/react-timeline-editor'
import { useVideoEditorStore } from '../store/editor-store'
import { CLIP_EFFECT_IDS, selectVisibleClips } from '../store/selectors'
import { framesToSeconds, secondsToFrames } from '../utils/time'
import { usePlayerRef } from '../engine/player-ref'
import { TrackHeaders } from './track-headers'
import { VideoBlock } from './renderers/video-block'
import { AudioBlock } from './renderers/audio-block'
import { TextBlock } from './renderers/text-block'
import { ImageBlock } from './renderers/image-block'
import type { ProjectState } from '../store/types'
import type {
  TimelineEditor,
  TimelineState,
} from '@xzdarcy/react-timeline-editor'
import type { TimelineEffect } from '@xzdarcy/timeline-engine'

const ROW_HEIGHT = 44
const HEADERS_WIDTH = 192
const SCALE_WIDTH_BASE = 80
const SCALE_SECONDS = 5
// Fraction of the dragged clip that must overlap a row for the drop to be
// treated as "insert into this track". Below this threshold the drop is
// interpreted as "create new track above/below", so a higher value here
// gives users a more forgiving margin to target the gap.
const INSERT_OVERLAP_THRESHOLD = 0.65

type DragGuide =
  | { mode: 'insert'; targetIndex: number; valid: boolean }
  | { mode: 'create'; insertIndex: number }
  | null

type ClipKind = 'video' | 'audio' | 'text' | 'image'

interface DragSession {
  clipId: string
  clipKind: ClipKind
  clipLabel: string
  sourceTrackIndex: number
  startClientY: number | null
  scrollTopAtStart: number
}

interface DragGhost {
  top: number
  left: number
  width: number
  height: number
  kind: ClipKind
  label: string
  valid: boolean
}

export function VideoTimeline() {
  const playerRef = usePlayerRef()
  const timelineStateRef = useRef<TimelineState | null>(null)
  const programmaticTimeRef = useRef(false)

  const fps = useVideoEditorStore((s) => s.fps)
  const zoomScale = useVideoEditorStore((s) => s.zoomScale)
  const currentFrame = useVideoEditorStore((s) => s.currentFrame)
  const durationInFrames = useVideoEditorStore((s) => s.durationInFrames)
  const tracks = useVideoEditorStore((s) => s.tracks)
  const viewport = useVideoEditorStore((s) => s.viewport)
  const selection = useVideoEditorStore((s) => s.selection)

  const moveClip = useVideoEditorStore((s) => s.moveClip)
  const moveClipToTrack = useVideoEditorStore((s) => s.moveClipToTrack)
  const moveClipToNewTrack = useVideoEditorStore((s) => s.moveClipToNewTrack)
  const resizeClip = useVideoEditorStore((s) => s.resizeClip)
  const seekToFrame = useVideoEditorStore((s) => s.seekToFrame)
  const selectClip = useVideoEditorStore((s) => s.selectClip)
  const setViewport = useVideoEditorStore((s) => s.setViewport)

  const [scrollTop, setScrollTop] = useState(0)
  const scrollTopRef = useRef(0)
  useEffect(() => {
    scrollTopRef.current = scrollTop
  }, [scrollTop])

  const scrollLeftRef = useRef(0)

  const tracksRef = useRef(tracks)
  useEffect(() => {
    tracksRef.current = tracks
  }, [tracks])

  const scaleWidthRef = useRef(0)
  const fpsRef = useRef(fps)
  useEffect(() => {
    fpsRef.current = fps
  }, [fps])

  // Memoize the windowed editor data on stable inputs so xzdarcy receives
  // a stable `editorData` reference unless underlying clip data actually
  // changes. Including currentFrame here would re-render every playback tick.
  const { rows, clipById } = useMemo(() => {
    const stateLike = {
      fps,
      tracks,
      viewport,
      selection,
      durationInFrames: 0,
      currentFrame: 0,
      aspectRatio: '16:9',
      width: 0,
      height: 0,
      zoomScale: 1,
      isPlaying: false,
    } as unknown as ProjectState
    return selectVisibleClips(stateLike)
  }, [fps, tracks, viewport, selection])

  const effects = useMemo<Record<string, TimelineEffect>>(
    () => ({
      [CLIP_EFFECT_IDS.video]: { id: CLIP_EFFECT_IDS.video, name: 'Video' },
      [CLIP_EFFECT_IDS.audio]: { id: CLIP_EFFECT_IDS.audio, name: 'Audio' },
      [CLIP_EFFECT_IDS.text]: { id: CLIP_EFFECT_IDS.text, name: 'Text' },
      [CLIP_EFFECT_IDS.image]: { id: CLIP_EFFECT_IDS.image, name: 'Image' },
    }),
    [],
  )

  // Slave the xzdarcy cursor to the master `currentFrame` in the store.
  useEffect(() => {
    const t = timelineStateRef.current
    if (!t) return
    const seconds = framesToSeconds(currentFrame, fps)
    const cur = t.getTime()
    if (Math.abs(cur - seconds) > 0.005) {
      programmaticTimeRef.current = true
      t.setTime(seconds)
      // Allow self-triggered cursor events to be ignored on the same tick.
      const id = window.setTimeout(() => {
        programmaticTimeRef.current = false
      }, 0)
      return () => window.clearTimeout(id)
    }
  }, [currentFrame, fps])

  // Keep the virtualization viewport covering the whole project length so
  // every clip is rendered. (The architecture supports windowing; for v1 we
  // simply expand the viewport whenever duration changes.)
  useEffect(() => {
    const totalSec = framesToSeconds(durationInFrames, fps)
    setViewport(0, Math.max(60, totalSec + 5))
  }, [durationInFrames, fps, setViewport])

  const scaleWidth = Math.max(20, SCALE_WIDTH_BASE * zoomScale)
  scaleWidthRef.current = scaleWidth
  const minScaleCount = Math.ceil(
    Math.max(20, framesToSeconds(durationInFrames, fps) / SCALE_SECONDS) + 4,
  )

  const handleSeek = useCallback(
    (timeSec: number) => {
      const frame = secondsToFrames(timeSec, fps)
      seekToFrame(frame)
      playerRef.current?.seekTo(frame)
    },
    [fps, seekToFrame, playerRef],
  )

  const handleClickTimeArea = useCallback<
    NonNullable<TimelineEditor['onClickTimeArea']>
  >(
    (time) => {
      handleSeek(time)
      return true
    },
    [handleSeek],
  )

  const handleCursorDragEnd = useCallback<
    NonNullable<TimelineEditor['onCursorDragEnd']>
  >(
    (time) => {
      if (programmaticTimeRef.current) return
      handleSeek(time)
    },
    [handleSeek],
  )

  // Use `onClickActionOnly` (not `onClickAction`) so that a click which is
  // actually the end of a drag/resize doesn't trigger selection. xzdarcy
  // suppresses this callback when the pointer moved between mousedown and
  // mouseup. We also stop propagation so the bubbling row click below
  // doesn't immediately clear the selection we just set.
  const handleClickActionOnly = useCallback<
    NonNullable<TimelineEditor['onClickActionOnly']>
  >(
    (e, { action }) => {
      e.stopPropagation()
      selectClip(action.id)
    },
    [selectClip],
  )

  const handleClickRow = useCallback<
    NonNullable<TimelineEditor['onClickRow']>
  >((e) => {
    if (eventOriginatedOnAction(e)) return
    selectClip(null)
  }, [selectClip])

  // Cross-track DnD state. We piggy-back on xzdarcy's horizontal drag and
  // track the pointer's vertical motion ourselves with a window mousemove
  // listener attached for the duration of the gesture.
  const dragSessionRef = useRef<DragSession | null>(null)
  const dragGuideRef = useRef<DragGuide>(null)
  const dragLiveSecRef = useRef<{ start: number; end: number } | null>(null)
  const [dragGuide, setDragGuide] = useState<DragGuide>(null)
  const [editAreaRect, setEditAreaRect] = useState<DOMRect | null>(null)
  const [dragGhost, setDragGhost] = useState<DragGhost | null>(null)

  const updateDragGuide = useCallback((next: DragGuide) => {
    const prev = dragGuideRef.current
    if (sameDragGuide(prev, next)) return
    dragGuideRef.current = next
    setDragGuide(next)
  }, [])

  const getEditAreaEl = useCallback((): HTMLElement | null => {
    const root = timelineStateRef.current?.target
    if (!root) return null
    return root.querySelector<HTMLElement>('.timeline-editor-edit-area')
  }, [])

  const finishDragSession = useCallback(() => {
    dragSessionRef.current = null
    dragLiveSecRef.current = null
    updateDragGuide(null)
    setEditAreaRect(null)
    setDragGhost(null)
  }, [updateDragGuide])

  const handleWindowMouseMove = useCallback(
    (e: MouseEvent) => {
      const session = dragSessionRef.current
      if (!session) return
      if (session.startClientY === null) {
        session.startClientY = e.clientY
      }
      const tracksList = tracksRef.current
      if (tracksList.length === 0) return

      const clip = findClipById(tracksList, session.clipId)
      if (!clip) return

      // Compute ghost position in edit-area-local coordinates so that it
      // lines up with the rows regardless of scroll changes during drag.
      const sourceRowTop = session.sourceTrackIndex * ROW_HEIGHT
      const deltaPointer = e.clientY - session.startClientY
      const deltaScroll = scrollTopRef.current - session.scrollTopAtStart
      const ghostTop = sourceRowTop + deltaPointer + deltaScroll
      const ghostMid = ghostTop + ROW_HEIGHT / 2

      let bestRow = -1
      let bestOverlap = 0
      for (let i = 0; i < tracksList.length; i += 1) {
        const rowTop = i * ROW_HEIGHT
        const overlap = Math.max(
          0,
          Math.min(ghostTop + ROW_HEIGHT, rowTop + ROW_HEIGHT) -
            Math.max(ghostTop, rowTop),
        )
        if (overlap > bestOverlap) {
          bestOverlap = overlap
          bestRow = i
        }
      }

      let nextGuide: DragGuide
      if (bestRow >= 0 && bestOverlap / ROW_HEIGHT > INSERT_OVERLAP_THRESHOLD) {
        const target = tracksList[bestRow]
        nextGuide = {
          mode: 'insert',
          targetIndex: bestRow,
          valid: target.type === clip.type,
        }
      } else {
        // Decide insertion gap: gap g sits at y = g * ROW_HEIGHT, where
        // g in [0, tracksList.length].
        let bestGap = 0
        let bestDist = Infinity
        for (let g = 0; g <= tracksList.length; g += 1) {
          const gapY = g * ROW_HEIGHT
          const dist = Math.abs(ghostMid - gapY)
          if (dist < bestDist) {
            bestDist = dist
            bestGap = g
          }
        }
        nextGuide = { mode: 'create', insertIndex: bestGap }
      }
      updateDragGuide(nextGuide)

      // Compute the ghost rectangle in screen coordinates so users get a
      // tangible "this is where the clip will land" preview.
      const editArea = getEditAreaEl()
      if (!editArea) return
      const rect = editArea.getBoundingClientRect()
      const live = dragLiveSecRef.current
      const startSec = live?.start ?? framesToSeconds(clip.startFrame, fpsRef.current)
      const endSec = live?.end ?? framesToSeconds(clip.endFrame, fpsRef.current)
      const pxPerSec = scaleWidthRef.current / SCALE_SECONDS
      const widthLocal = Math.max(8, (endSec - startSec) * pxPerSec)
      const leftLocal = 20 + startSec * pxPerSec
      const ghostScreenLeft = rect.left + leftLocal - scrollLeftRef.current
      const ghostScreenTop = rect.top + ghostTop - scrollTopRef.current
      const valid =
        nextGuide?.mode === 'insert'
          ? nextGuide.valid
          : nextGuide?.mode === 'create'
            ? true
            : true
      setDragGhost({
        top: ghostScreenTop,
        left: ghostScreenLeft,
        width: widthLocal,
        height: ROW_HEIGHT,
        kind: session.clipKind,
        label: session.clipLabel,
        valid,
      })
    },
    [getEditAreaEl, updateDragGuide],
  )

  const handleWindowMouseUp = useCallback(() => {
    // The xzdarcy onActionMoveEnd handler runs first (via library's mouseup)
    // and reads dragGuideRef. We just clean up the listeners afterwards.
    window.removeEventListener('mousemove', handleWindowMouseMove)
    window.removeEventListener('mouseup', handleWindowMouseUp)
    // Defer cleanup to next tick so onActionMoveEnd can still read the
    // session info if it fires after this in some browsers.
    window.setTimeout(() => {
      finishDragSession()
    }, 0)
  }, [finishDragSession, handleWindowMouseMove])

  const handleActionMoveStart = useCallback<
    NonNullable<TimelineEditor['onActionMoveStart']>
  >(
    ({ action }) => {
      const tracksList = tracksRef.current
      const sourceTrackIndex = tracksList.findIndex((t) =>
        t.clips.some((c) => c.id === action.id),
      )
      if (sourceTrackIndex < 0) return
      const sourceClip = tracksList[sourceTrackIndex].clips.find(
        (c) => c.id === action.id,
      )
      if (!sourceClip) return
      dragSessionRef.current = {
        clipId: action.id,
        clipKind: sourceClip.type,
        clipLabel: clipDisplayLabel(sourceClip),
        sourceTrackIndex,
        startClientY: null,
        scrollTopAtStart: scrollTopRef.current,
      }
      dragLiveSecRef.current = {
        start: framesToSeconds(sourceClip.startFrame, fpsRef.current),
        end: framesToSeconds(sourceClip.endFrame, fpsRef.current),
      }
      const editArea = getEditAreaEl()
      if (editArea) setEditAreaRect(editArea.getBoundingClientRect())
      window.addEventListener('mousemove', handleWindowMouseMove)
      window.addEventListener('mouseup', handleWindowMouseUp)
    },
    [getEditAreaEl, handleWindowMouseMove, handleWindowMouseUp],
  )

  const handleActionMoving = useCallback<
    NonNullable<TimelineEditor['onActionMoving']>
  >(({ start, end }) => {
    dragLiveSecRef.current = { start, end }
  }, [])

  const handleActionMoveEnd = useCallback<
    NonNullable<TimelineEditor['onActionMoveEnd']>
  >(
    ({ action, start }) => {
      const clip = clipById[action.id]
      if (!clip) return

      const newStartFrame = secondsToFrames(start, fps)
      const delta = newStartFrame - clip.startFrame
      const guide = dragGuideRef.current
      const tracksList = tracksRef.current
      const sourceTrackIndex = tracksList.findIndex((t) =>
        t.clips.some((c) => c.id === clip.id),
      )

      if (!guide) {
        if (delta !== 0) moveClip(clip.id, delta)
        return
      }

      if (guide.mode === 'insert') {
        const target = tracksList[guide.targetIndex]
        if (!target) {
          if (delta !== 0) moveClip(clip.id, delta)
          return
        }
        if (guide.targetIndex === sourceTrackIndex) {
          if (delta !== 0) moveClip(clip.id, delta)
          return
        }
        if (!guide.valid) {
          // Type mismatch: snap back, no-op.
          return
        }
        moveClipToTrack(clip.id, target.id, newStartFrame)
        return
      }

      // mode === 'create' — create a new track at the gap.
      // If the gap falls right where the source clip is the only inhabitant
      // of its track (i.e. moving it would leave a hole and re-create the
      // same kind of track), the result is functionally a no-op visually but
      // the track id changes. Avoid that churn when the gap is the source
      // row's own boundary.
      const gap = guide.insertIndex
      const isSourceOnly =
        sourceTrackIndex >= 0 &&
        tracksList[sourceTrackIndex]?.clips.length === 1
      const sourceRowGapTop = sourceTrackIndex
      const sourceRowGapBottom = sourceTrackIndex + 1
      if (
        isSourceOnly &&
        (gap === sourceRowGapTop || gap === sourceRowGapBottom)
      ) {
        if (delta !== 0) moveClip(clip.id, delta)
        return
      }
      moveClipToNewTrack(clip.id, gap, newStartFrame)
    },
    [clipById, fps, moveClip, moveClipToNewTrack, moveClipToTrack],
  )

  const handleActionResizeEnd = useCallback<
    NonNullable<TimelineEditor['onActionResizeEnd']>
  >(
    ({ action, start, end, dir }) => {
      const clip = clipById[action.id]
      if (!clip) return
      if (dir === 'left') {
        resizeClip(clip.id, 'left', secondsToFrames(start, fps))
      } else {
        resizeClip(clip.id, 'right', secondsToFrames(end, fps))
      }
    },
    [clipById, fps, resizeClip],
  )

  const getActionRender = useCallback<
    NonNullable<TimelineEditor['getActionRender']>
  >(
    (action) => {
      const clip = clipById[action.id]
      if (!clip) {
        return (
          <div className="flex h-full w-full items-center rounded-md border border-border bg-card px-2 text-[11px] text-muted-foreground">
            {action.id}
          </div>
        )
      }
      const selected = !!action.selected
      if (clip.type === 'video') {
        return (
          <VideoBlock
            clip={clip}
            selected={selected}
            durationSec={framesToSeconds(
              clip.sourceDurationInFrames || clip.endFrame - clip.startFrame,
              fps,
            )}
          />
        )
      }
      if (clip.type === 'audio') {
        return <AudioBlock clip={clip} selected={selected} />
      }
      if (clip.type === 'image') {
        return <ImageBlock clip={clip} selected={selected} />
      }
      return <TextBlock clip={clip} selected={selected} />
    },
    [clipById, fps],
  )

  const handleScroll = useCallback<NonNullable<TimelineEditor['onScroll']>>(
    (p) => {
      scrollLeftRef.current = p.scrollLeft
      setScrollTop(p.scrollTop)
    },
    [],
  )

  const onChange = useCallback<NonNullable<TimelineEditor['onChange']>>(
    () => false,
    [],
  )

  // Detach window listeners on unmount as a safety net.
  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove)
      window.removeEventListener('mouseup', handleWindowMouseUp)
    }
  }, [handleWindowMouseMove, handleWindowMouseUp])

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <div className="flex flex-1 overflow-hidden">
        <TrackHeaders
          rowHeight={ROW_HEIGHT}
          scrollTop={scrollTop}
          width={HEADERS_WIDTH}
        />
        <div className="relative flex-1 overflow-hidden">
          <Timeline
            ref={(node) => {
              timelineStateRef.current = node
            }}
            editorData={rows}
            effects={effects}
            scale={SCALE_SECONDS}
            scaleWidth={scaleWidth}
            scaleSplitCount={5}
            startLeft={20}
            rowHeight={ROW_HEIGHT}
            minScaleCount={minScaleCount}
            autoScroll
            dragLine
            autoReRender
            onScroll={handleScroll}
            onClickTimeArea={handleClickTimeArea}
            onCursorDragEnd={handleCursorDragEnd}
            onClickActionOnly={handleClickActionOnly}
            onClickRow={handleClickRow}
            onActionMoveStart={handleActionMoveStart}
            onActionMoving={handleActionMoving}
            onActionMoveEnd={handleActionMoveEnd}
            onActionResizeEnd={handleActionResizeEnd}
            getActionRender={getActionRender}
            onChange={onChange}
            style={{ height: '100%', width: '100%' }}
          />
        </div>
      </div>
      <CrossTrackDragOverlay
        guide={dragGuide}
        editAreaRect={editAreaRect}
        scrollTop={scrollTop}
      />
      <DragGhostOverlay ghost={dragGhost} />
    </div>
  )
}

interface CrossTrackDragOverlayProps {
  guide: DragGuide
  editAreaRect: DOMRect | null
  scrollTop: number
}

function CrossTrackDragOverlay({
  guide,
  editAreaRect,
  scrollTop,
}: CrossTrackDragOverlayProps) {
  if (!guide || !editAreaRect) return null
  if (typeof document === 'undefined') return null

  if (guide.mode === 'insert') {
    const top = editAreaRect.top + guide.targetIndex * ROW_HEIGHT - scrollTop
    return createPortal(
      <div
        className="pointer-events-none fixed z-50"
        style={{
          top,
          left: editAreaRect.left,
          width: editAreaRect.width,
          height: ROW_HEIGHT,
        }}
      >
        <div
          className={
            'h-full w-full rounded-sm border-2 ' +
            (guide.valid
              ? 'border-emerald-400/90 bg-emerald-400/10'
              : 'border-rose-500/90 bg-rose-500/10')
          }
        />
      </div>,
      document.body,
    )
  }

  const top =
    editAreaRect.top + guide.insertIndex * ROW_HEIGHT - scrollTop - 1.5
  return createPortal(
    <div
      className="pointer-events-none fixed z-50"
      style={{
        top,
        left: editAreaRect.left,
        width: editAreaRect.width,
        height: 3,
      }}
    >
      <div className="h-full w-full rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
    </div>,
    document.body,
  )
}

function eventOriginatedOnAction(
  e: { target: EventTarget | null } | null | undefined,
): boolean {
  if (!e) return false
  const target = e.target
  if (!(target instanceof Element)) return false
  return Boolean(target.closest('.timeline-editor-action'))
}

function findClipById<C extends { id: string }>(
  tracks: ReadonlyArray<{ clips: ReadonlyArray<C> }>,
  clipId: string,
): C | null {
  for (const t of tracks) {
    for (const c of t.clips) {
      if (c.id === clipId) return c
    }
  }
  return null
}

function sameDragGuide(a: DragGuide, b: DragGuide): boolean {
  if (a === b) return true
  if (!a || !b) return false
  if (a.mode !== b.mode) return false
  if (a.mode === 'insert' && b.mode === 'insert') {
    return a.targetIndex === b.targetIndex && a.valid === b.valid
  }
  if (a.mode === 'create' && b.mode === 'create') {
    return a.insertIndex === b.insertIndex
  }
  return false
}

function clipDisplayLabel(clip: {
  type: ClipKind
  fileName?: string
  text?: string
}): string {
  if (clip.type === 'text') return clip.text || 'Text'
  return clip.fileName || clip.type
}

const GHOST_STYLES: Record<
  ClipKind,
  { bg: string; border: string; fg: string }
> = {
  video: {
    bg: 'linear-gradient(180deg, rgba(37,99,235,0.85) 0%, rgba(29,78,216,0.85) 100%)',
    border: 'rgba(255,255,255,0.95)',
    fg: '#eff6ff',
  },
  audio: {
    bg: 'linear-gradient(180deg, rgba(245,158,11,0.85) 0%, rgba(217,119,6,0.85) 100%)',
    border: 'rgba(255,255,255,0.95)',
    fg: '#fffbeb',
  },
  text: {
    bg: 'linear-gradient(180deg, rgba(59,130,246,0.85) 0%, rgba(37,99,235,0.85) 100%)',
    border: 'rgba(255,255,255,0.95)',
    fg: '#eff6ff',
  },
  image: {
    bg: 'linear-gradient(180deg, rgba(16,185,129,0.85) 0%, rgba(5,150,105,0.85) 100%)',
    border: 'rgba(255,255,255,0.95)',
    fg: '#ecfdf5',
  },
}

interface DragGhostOverlayProps {
  ghost: DragGhost | null
}

function DragGhostOverlay({ ghost }: DragGhostOverlayProps) {
  if (!ghost) return null
  if (typeof document === 'undefined') return null
  const style = GHOST_STYLES[ghost.kind]
  return createPortal(
    <div
      className="pointer-events-none fixed z-50"
      style={{
        top: ghost.top,
        left: ghost.left,
        width: ghost.width,
        height: ghost.height,
        opacity: ghost.valid ? 0.95 : 0.6,
      }}
    >
      <div
        className="flex h-full w-full items-center overflow-hidden rounded-md px-2 text-[11px] shadow-lg"
        style={{
          background: style.bg,
          border: `1.5px dashed ${ghost.valid ? style.border : 'rgba(244,63,94,0.95)'}`,
          color: style.fg,
        }}
      >
        <span className="truncate">{ghost.label}</span>
      </div>
    </div>,
    document.body,
  )
}
