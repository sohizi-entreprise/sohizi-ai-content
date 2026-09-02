import { useCallback, useEffect, useRef } from "react"
import { useMutation } from "@tanstack/react-query"
import { useVideoEditorStore } from "../store/editor-store"
import { useVideoEditorUiStore } from "../store/ui-store"
import { batchEditMutationOptions } from "../query-mutations"
import { diffStateToBatchOps, diffableSnapshotsEqual } from "../transforms"
import { batchEdit } from "../requests"
import type { AspectRatio, Track } from "../store/types"
import type { BatchOperation } from "../requests"

type SnapshotState = {
  compositionId: string
  fps: number
  durationInFrames: number
  aspectRatio: AspectRatio
  width: number
  height: number
  tracks: Array<Track>
}

const AUTOSAVE_DEBOUNCE_MS = 1500

function takeSnapshot(): SnapshotState | null {
  const s = useVideoEditorStore.getState()
  if (!s.compositionId) return null
  return {
    compositionId: s.compositionId,
    fps: s.fps,
    durationInFrames: s.durationInFrames,
    aspectRatio: s.aspectRatio,
    width: s.width,
    height: s.height,
    tracks: structuredClone(s.tracks),
  }
}

export function useVideoEditorAutosave() {
  const projectId = useVideoEditorStore((s) => s.projectId)
  const compositionId = useVideoEditorStore((s) => s.compositionId)
  const isHydrated = useVideoEditorStore((s) => s.isHydrated)

  const { mutateAsync: sendBatch } = useMutation(
    batchEditMutationOptions(projectId ?? "", compositionId ?? ""),
  )

  const lastSavedRef = useRef<SnapshotState | null>(null)
  const pendingOpsRef = useRef<Array<BatchOperation> | null>(null)
  const isSavingRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runSave = useCallback(
    async (ops: Array<BatchOperation>) => {
      if (isSavingRef.current) {
        pendingOpsRef.current = ops
        return
      }
      if (ops.length === 0) return

      isSavingRef.current = true
      const { setSaveStatus } = useVideoEditorUiStore.getState()
      setSaveStatus("saving")
      try {
        await sendBatch(ops)
        setSaveStatus("saved")
      } catch (err) {
        setSaveStatus("idle")
        console.error("[video-autosave] batch save failed:", err)
      } finally {
        isSavingRef.current = false

        const pending = pendingOpsRef.current
        pendingOpsRef.current = null
        if (pending && pending.length > 0) {
          void runSave(pending)
        }
      }
    },
    [sendBatch],
  )

  useEffect(() => {
    if (!isHydrated || !compositionId || !projectId) return

    lastSavedRef.current = takeSnapshot()

    const unsubscribe = useVideoEditorStore.subscribe(() => {
      const prev = lastSavedRef.current
      const current = takeSnapshot()
      if (!prev || !current || diffableSnapshotsEqual(prev, current)) return

      if (timerRef.current) clearTimeout(timerRef.current)

      timerRef.current = setTimeout(() => {
        timerRef.current = null

        const lastSaved = lastSavedRef.current
        const next = takeSnapshot()
        if (!lastSaved || !next) return

        const ops = diffStateToBatchOps(lastSaved, next)
        if (ops.length === 0) return

        lastSavedRef.current = next
        void runSave(ops)
      }, AUTOSAVE_DEBOUNCE_MS)
    })

    return () => {
      unsubscribe()
      useVideoEditorUiStore.getState().setSaveStatus("idle")
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }

      // Flush any unsaved changes before unmount. The store is still
      // intact at this point (parent cleanup runs after children).
      const prev = lastSavedRef.current
      const next = takeSnapshot()
      if (prev && next) {
        const ops = diffStateToBatchOps(prev, next)
        if (ops.length > 0) {
          lastSavedRef.current = next
          void batchEdit(projectId, compositionId, ops).catch((err) =>
            console.error("[video-autosave] flush failed:", err),
          )
        }
      }
    }
  }, [isHydrated, compositionId, projectId, runSave])
}
