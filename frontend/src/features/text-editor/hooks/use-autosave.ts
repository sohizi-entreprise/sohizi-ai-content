import { useRef, useCallback, useEffect } from 'react'
import type { JSONContent } from '@tiptap/react'
import * as requests from '@/features/projects/request'
import type { UpdateProjectInput } from '@/features/projects/type'

export type AutosavePayload =
  | { type: 'synopsis'; content: JSONContent }
  | { type: 'script'; content: JSONContent }

type UseAutosaveOptions = {
  /** Debounce delay in milliseconds */
  duration: number
  /** Project id to update */
  projectId: string | null
  /** Called after a save completes (success or error) */
  onSaveComplete?: () => void
  /** Called when a save fails */
  onSaveError?: (error: Error) => void
}

/**
 * Returns a debounced save function. Call it with the current payload (synopsis or script)
 * whenever the editor content changes; the actual save runs after `duration` ms of no further calls.
 */
export function useAutosave({
  duration,
  projectId,
  onSaveComplete,
  onSaveError,
}: UseAutosaveOptions) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isSavingRef = useRef(false)
  const projectIdRef = useRef(projectId)
  const durationRef = useRef(duration)
  const onSaveCompleteRef = useRef(onSaveComplete)
  const onSaveErrorRef = useRef(onSaveError)

  projectIdRef.current = projectId
  durationRef.current = duration
  onSaveCompleteRef.current = onSaveComplete
  onSaveErrorRef.current = onSaveError

  const save = useCallback((payload: AutosavePayload) => {
    if (!projectIdRef.current) return

    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    timeoutRef.current = setTimeout(async () => {
      timeoutRef.current = null
      const pid = projectIdRef.current
      if (!pid || isSavingRef.current) return

      const body: UpdateProjectInput =
        payload.type === 'synopsis'
          ? { synopsis: payload.content }
          : { script: payload.content }

      isSavingRef.current = true
      try {
        await requests.updateProject(pid, body)
        onSaveCompleteRef.current?.()
      } catch (err) {
        onSaveErrorRef.current?.(err instanceof Error ? err : new Error(String(err)))
      } finally {
        isSavingRef.current = false
      }
    }, durationRef.current)
  }, [])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [])

  return save
}
