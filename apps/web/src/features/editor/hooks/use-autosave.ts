import { useCallback, useEffect, useLayoutEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  markPendingOperationApplied,
  writeMarkdownContentCache,
} from "../query-mutations"
import { useEditorStore } from "../stores/editor-store"
import { saveFileContent } from "../requests"

export type AutosavePayload = {
  content: string
  diffApplied?: boolean
}

type UseAutosaveOptions = {
  duration: number
  projectId: string
  fileId: string
  onSaveComplete?: () => void
  onSaveError?: (error: Error) => void
}

type SaveContext = { projectId: string; fileId: string }

type AutosaveCoreOptions<TInput, TPayload> = UseAutosaveOptions & {
  /** Resolve the debounced input into the payload sent to the server. */
  resolveInput: (input: TInput) => TPayload
  /** Reflect the payload in the query cache immediately (optimistic). */
  writeOptimisticCache: (payload: TPayload, ctx: SaveContext) => void
  /** Persist the payload and update the cache with server data on success. */
  persist: (payload: TPayload, ctx: SaveContext) => Promise<void>
}

/**
 * Shared autosave engine. It debounces `save()`, but crucially it also FLUSHES
 * any pending work when the file changes, the editor unmounts (tab switch), or
 * the page is hidden. Persistence goes through the provided `persist` function
 * (a raw request, not a component-bound mutation) so a flush that runs during
 * unmount still completes. Without this, switching tabs before the debounce
 * fired dropped the edit and left the saving indicator stuck on "saving".
 */
function useAutosaveCore<TInput, TPayload>(
  options: AutosaveCoreOptions<TInput, TPayload>,
) {
  const { duration, projectId, fileId } = options

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isSavingRef = useRef(false)
  // The most recent input scheduled by the debounce but not yet sent.
  const latestInputRef = useRef<TInput | null>(null)
  // A payload captured while a save is in flight, to send once it settles.
  const pendingPayloadRef = useRef<TPayload | null>(null)

  const projectIdRef = useRef(projectId)
  const fileIdRef = useRef(fileId)
  const durationRef = useRef(duration)
  const resolveInputRef = useRef(options.resolveInput)
  const writeOptimisticCacheRef = useRef(options.writeOptimisticCache)
  const persistRef = useRef(options.persist)
  const onSaveCompleteRef = useRef(options.onSaveComplete)
  const onSaveErrorRef = useRef(options.onSaveError)

  projectIdRef.current = projectId
  fileIdRef.current = fileId
  durationRef.current = duration
  resolveInputRef.current = options.resolveInput
  writeOptimisticCacheRef.current = options.writeOptimisticCache
  persistRef.current = options.persist
  onSaveCompleteRef.current = options.onSaveComplete
  onSaveErrorRef.current = options.onSaveError

  const setSavingStatus = useEditorStore((s) => s.setSavingStatus)

  const runSave = useCallback(
    async (payload: TPayload, ctx: SaveContext) => {
      // Always reflect the latest payload in the cache so a switch-away-and-back
      // remounts from the newest content instead of the last server revision.
      writeOptimisticCacheRef.current(payload, ctx)

      if (isSavingRef.current) {
        pendingPayloadRef.current = payload
        return
      }

      isSavingRef.current = true
      setSavingStatus(ctx.fileId, "saving")
      try {
        await persistRef.current(payload, ctx)
        onSaveCompleteRef.current?.()
        setSavingStatus(ctx.fileId, "saved")
      } catch (error) {
        setSavingStatus(ctx.fileId, "error")
        onSaveErrorRef.current?.(
          error instanceof Error ? error : new Error(String(error)),
        )
      } finally {
        isSavingRef.current = false

        const next = pendingPayloadRef.current
        pendingPayloadRef.current = null
        if (next !== null) {
          void runSave(next, ctx)
        }
      }
    },
    [setSavingStatus],
  )

  // Send whatever is scheduled right now for the given file, cancelling the
  // debounce. Used by unmount / file-change / pagehide flushes.
  const flush = useCallback(
    (ctx: SaveContext) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }

      const pending = latestInputRef.current
      latestInputRef.current = null
      if (pending === null) return
      if (!ctx.projectId || !ctx.fileId) return

      void runSave(resolveInputRef.current(pending), ctx)
    },
    [runSave],
  )

  const save = useCallback(
    (input: TInput) => {
      const activeProjectId = projectIdRef.current
      const activeFileId = fileIdRef.current
      if (!activeProjectId || !activeFileId) return

      // Only schedule here; expensive serialization is deferred to flush time.
      latestInputRef.current = input
      setSavingStatus(activeFileId, "saving")

      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null
        const pending = latestInputRef.current
        latestInputRef.current = null
        if (pending === null) return

        const ctx = {
          projectId: projectIdRef.current,
          fileId: fileIdRef.current,
        }
        if (!ctx.projectId || !ctx.fileId) return
        void runSave(resolveInputRef.current(pending), ctx)
      }, durationRef.current)
    },
    [runSave, setSavingStatus],
  )

  // Flush on unmount (tab switch unmounts the keyed editor) and whenever the
  // file changes. The cleanup captures the OLD ctx so pending edits are written
  // to the file they belong to. useLayoutEffect runs its cleanup before the
  // editor's passive-effect destroy, so a deferred serializer still sees a live
  // editor.
  useLayoutEffect(() => {
    const ctx = { projectId, fileId }
    return () => {
      flush(ctx)
    }
  }, [projectId, fileId, flush])

  // Persist before the browser tab is closed/reloaded instead of relying on the
  // debounce, which would otherwise be discarded.
  useEffect(() => {
    const handler = () => {
      flush({ projectId: projectIdRef.current, fileId: fileIdRef.current })
    }
    window.addEventListener("pagehide", handler)
    return () => {
      window.removeEventListener("pagehide", handler)
    }
  }, [flush])

  return save
}

/**
 * Returns a debounced save function for markdown / storyboard content. Call it
 * with the current markdown whenever the editor changes; the save runs after
 * `duration` ms of quiet, or immediately on tab switch / page hide.
 */
export function useAutoSave({
  duration,
  projectId,
  fileId,
  onSaveComplete,
  onSaveError,
}: UseAutosaveOptions) {
  const queryClient = useQueryClient()

  return useAutosaveCore<AutosavePayload, AutosavePayload>({
    duration,
    projectId,
    fileId,
    onSaveComplete,
    onSaveError,
    resolveInput: (input) => input,
    writeOptimisticCache: (payload, ctx) => {
      writeMarkdownContentCache(queryClient, ctx.projectId, ctx.fileId, {
        content: payload.content,
      })
    },
    persist: async (payload, ctx) => {
      const result = await saveFileContent(
        ctx.projectId,
        ctx.fileId,
        payload.content,
        payload.diffApplied,
      )
      writeMarkdownContentCache(queryClient, ctx.projectId, ctx.fileId, {
        content: result.content,
        revision: result.revision,
      })
      if (result.pendingDiffApplied) {
        markPendingOperationApplied(
          queryClient,
          ctx.projectId,
          ctx.fileId,
          payload.content,
        )
      }
    },
  })
}
