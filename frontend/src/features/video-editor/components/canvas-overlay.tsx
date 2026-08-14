import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useVideoEditorStore } from '../store/editor-store'
import {
  getClipLayout,
  isCanvasEditableClip,
  type CanvasEditableClip,
  type SpatialLayout,
} from '../store/types'

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

type DragMode = 'move' | { resize: ResizeDirection }

interface DragState {
  pointerId: number
  mode: DragMode
  startClientX: number
  startClientY: number
  startXRatio: number
  startYRatio: number
  startWidthRatio: number
  startHeightRatio: number
  boxWidth: number
  boxHeight: number
  rafId: number | null
  pendingPatch: Partial<SpatialLayout> | null
}

const MIN_WIDTH_RATIO = 0.05
const MIN_HEIGHT_RATIO = 0.04
const HANDLE_SIZE = 10

export function CanvasOverlay() {
  const tracks = useVideoEditorStore((s) => s.tracks)
  const selection = useVideoEditorStore((s) => s.selection)
  const currentFrame = useVideoEditorStore((s) => s.currentFrame)
  const updateClip = useVideoEditorStore((s) => s.updateClip)
  const selectClip = useVideoEditorStore((s) => s.selectClip)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const [, forceRender] = useState(0)

  const activeClips = useMemo<Array<CanvasEditableClip>>(() => {
    const result: Array<CanvasEditableClip> = []
    for (const track of tracks) {
      if (track.hidden) continue
      for (const clip of track.clips) {
        if (!clip || !isCanvasEditableClip(clip)) continue
        if (currentFrame < clip.startFrame || currentFrame >= clip.endFrame) {
          continue
        }
        result.push(clip)
      }
    }
    return result
  }, [tracks, currentFrame])

  const selectedId =
    selection.clipIds.length === 1 ? selection.clipIds[0] : null
  const selectedClip = useMemo<CanvasEditableClip | null>(
    () => activeClips.find((c) => c.id === selectedId) ?? null,
    [activeClips, selectedId],
  )

  const applyLayoutPatch = useCallback(
    (clip: CanvasEditableClip, patch: Partial<SpatialLayout>) => {
      if (clip.type === 'caption') {
        // Read latest properties from the store so rAF-batched patches
        // don't overwrite each other with a stale React snapshot.
        const tracks = useVideoEditorStore.getState().tracks
        let current = clip
        for (const track of tracks) {
          const found = track.clips.find((c) => c.id === clip.id)
          if (found && found.type === 'caption') {
            current = found
            break
          }
        }
        if (current.type !== 'caption') return
        updateClip(clip.id, {
          properties: { ...current.properties, ...patch },
        })
        return
      }
      updateClip(clip.id, patch)
    },
    [updateClip],
  )

  const flushDrag = useCallback(() => {
    const drag = dragRef.current
    if (!drag) return
    drag.rafId = null
    if (!drag.pendingPatch) return
    if (!selectedClip) return
    applyLayoutPatch(selectedClip, drag.pendingPatch)
    drag.pendingPatch = null
  }, [selectedClip, applyLayoutPatch])

  const beginDrag = useCallback(
    (
      e: React.PointerEvent<HTMLDivElement>,
      mode: DragMode,
      clip: CanvasEditableClip,
    ) => {
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return

      const layout = getClipLayout(clip)

      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // ignore
      }
      const temporal = useVideoEditorStore.temporal as unknown as {
        getState: () => { pause: () => void; resume: () => void }
      }
      try {
        temporal.getState().pause()
      } catch {
        // ignore
      }

      dragRef.current = {
        pointerId: e.pointerId,
        mode,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startXRatio: layout.xRatio,
        startYRatio: layout.yRatio,
        startWidthRatio: layout.widthRatio,
        startHeightRatio: layout.heightRatio,
        boxWidth: rect.width,
        boxHeight: rect.height,
        rafId: null,
        pendingPatch: null,
      }
    },
    [],
  )

  const computePatch = useCallback(
    (
      drag: DragState,
      clientX: number,
      clientY: number,
    ): Partial<SpatialLayout> => {
      const dxNorm = (clientX - drag.startClientX) / drag.boxWidth
      const dyNorm = (clientY - drag.startClientY) / drag.boxHeight

      if (drag.mode === 'move') {
        return {
          xRatio: clamp01(drag.startXRatio + dxNorm),
          yRatio: clamp01(drag.startYRatio + dyNorm),
        }
      }

      const dir = drag.mode.resize
      const wFactor =
        dir === 'e' || dir === 'ne' || dir === 'se'
          ? 2
          : dir === 'w' || dir === 'nw' || dir === 'sw'
            ? -2
            : 0
      const hFactor =
        dir === 's' || dir === 'se' || dir === 'sw'
          ? 2
          : dir === 'n' || dir === 'ne' || dir === 'nw'
            ? -2
            : 0

      const newW = clampRatio(
        drag.startWidthRatio + wFactor * dxNorm,
        MIN_WIDTH_RATIO,
        2,
      )
      const newH = clampRatio(
        drag.startHeightRatio + hFactor * dyNorm,
        MIN_HEIGHT_RATIO,
        2,
      )

      return {
        widthRatio: newW,
        heightRatio: newH,
      }
    },
    [],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== e.pointerId) return
      drag.pendingPatch = computePatch(drag, e.clientX, e.clientY)
      if (drag.rafId === null) {
        drag.rafId = window.requestAnimationFrame(flushDrag)
      }
    },
    [computePatch, flushDrag],
  )

  const finalizeDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== e.pointerId) return
      if (drag.rafId !== null) {
        window.cancelAnimationFrame(drag.rafId)
        drag.rafId = null
      }
      const finalPatch = computePatch(drag, e.clientX, e.clientY)
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        // ignore
      }
      const temporal = useVideoEditorStore.temporal as unknown as {
        getState: () => { pause: () => void; resume: () => void }
      }
      try {
        temporal.getState().resume()
      } catch {
        // ignore
      }
      if (selectedClip) {
        applyLayoutPatch(selectedClip, finalPatch)
      }
      dragRef.current = null
      forceRender((n) => n + 1)
    },
    [computePatch, selectedClip, applyLayoutPatch],
  )

  useEffect(() => {
    if (!selectedClip) {
      const drag = dragRef.current
      if (drag?.rafId) window.cancelAnimationFrame(drag.rafId)
      dragRef.current = null
    }
  }, [selectedClip])

  const selectedLayout = selectedClip ? getClipLayout(selectedClip) : null

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0"
      data-slot="canvas-overlay"
    >
      {activeClips.map((clip) => {
        if (selectedClip && clip.id === selectedClip.id) return null
        const layout = getClipLayout(clip)
        return (
          <button
            key={clip.id}
            type="button"
            aria-label={`Select ${clip.type} clip`}
            onClick={(e) => {
              e.stopPropagation()
              selectClip(clip.id)
            }}
            className="pointer-events-auto absolute cursor-pointer border-0 bg-transparent p-0"
            style={{
              left: `${layout.xRatio * 100}%`,
              top: `${layout.yRatio * 100}%`,
              width: `${layout.widthRatio * 100}%`,
              height: `${layout.heightRatio * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
          />
        )
      })}

      {selectedClip && selectedLayout ? (
        <div
          className="pointer-events-none absolute"
          style={{
            left: `${selectedLayout.xRatio * 100}%`,
            top: `${selectedLayout.yRatio * 100}%`,
            width: `${selectedLayout.widthRatio * 100}%`,
            height: `${selectedLayout.heightRatio * 100}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div className="pointer-events-none absolute inset-0 rounded-[2px] border-2 border-primary shadow-[0_0_0_1px_rgba(0,0,0,0.55)]" />
          <div
            role="button"
            tabIndex={-1}
            aria-label={`Drag to move ${selectedClip.type}`}
            onPointerDown={(e) => beginDrag(e, 'move', selectedClip)}
            onPointerMove={handlePointerMove}
            onPointerUp={finalizeDrag}
            onPointerCancel={finalizeDrag}
            className="pointer-events-auto absolute cursor-move"
            style={{
              left: HANDLE_SIZE / 2,
              top: HANDLE_SIZE / 2,
              right: HANDLE_SIZE / 2,
              bottom: HANDLE_SIZE / 2,
              touchAction: 'none',
            }}
          />
          {(
            [
              { dir: 'nw', cursor: 'nwse-resize', x: 0, y: 0 },
              { dir: 'n', cursor: 'ns-resize', x: 50, y: 0 },
              { dir: 'ne', cursor: 'nesw-resize', x: 100, y: 0 },
              { dir: 'e', cursor: 'ew-resize', x: 100, y: 50 },
              { dir: 'se', cursor: 'nwse-resize', x: 100, y: 100 },
              { dir: 's', cursor: 'ns-resize', x: 50, y: 100 },
              { dir: 'sw', cursor: 'nesw-resize', x: 0, y: 100 },
              { dir: 'w', cursor: 'ew-resize', x: 0, y: 50 },
            ] as Array<{
              dir: ResizeDirection
              cursor: string
              x: number
              y: number
            }>
          ).map((h) => (
            <div
              key={h.dir}
              role="button"
              tabIndex={-1}
              aria-label={`Resize ${h.dir}`}
              onPointerDown={(e) =>
                beginDrag(e, { resize: h.dir }, selectedClip)
              }
              onPointerMove={handlePointerMove}
              onPointerUp={finalizeDrag}
              onPointerCancel={finalizeDrag}
              className="pointer-events-auto absolute rounded-full border border-black/50 bg-primary shadow"
              style={{
                left: `${h.x}%`,
                top: `${h.y}%`,
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                transform: 'translate(-50%, -50%)',
                cursor: h.cursor,
                touchAction: 'none',
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0
  if (v < 0) return 0
  if (v > 1) return 1
  return v
}

function clampRatio(v: number, min: number, max: number): number {
  if (Number.isNaN(v)) return min
  if (v < min) return min
  if (v > max) return max
  return v
}
