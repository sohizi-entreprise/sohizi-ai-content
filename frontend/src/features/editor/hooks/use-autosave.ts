import { useCallback, useEffect, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  saveFileContentDiffMutationOptions,
  saveFileContentMutationOptions,
} from '../query-mutations'
import type { CompactTextDiff } from '../requests'
import DiffWorker from '@/lib/workers/diff-worker?worker'

export type AutosavePayload = {
  content: string
}

type UseAutosaveOptions = {
  duration: number
  projectId: string
  fileId: string
  onSaveComplete?: () => void
  onSaveError?: (error: Error) => void
}

/**
 * Returns a debounced save function. Call it with the current payload (synopsis or script)
 * whenever the editor content changes; the actual save runs after `duration` ms of no further calls.
 */
export function useAutoSave({
  duration,
  projectId,
  fileId,
  onSaveComplete,
  onSaveError,
}: UseAutosaveOptions) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isSavingRef = useRef(false)
  const pendingContentRef = useRef<string | null>(null)
  const onSaveCompleteRef = useRef(onSaveComplete)
  const onSaveErrorRef = useRef(onSaveError)
  const { mutateAsync: saveFileContent } = useMutation(
    saveFileContentMutationOptions(projectId, fileId),
  )

  onSaveCompleteRef.current = onSaveComplete
  onSaveErrorRef.current = onSaveError

  const runSave = useCallback(
    async (content: string) => {
      if (isSavingRef.current) {
        pendingContentRef.current = content
        return
      }

      isSavingRef.current = true
      try {
        await saveFileContent(content)
        onSaveCompleteRef.current?.()
      } catch (error) {
        onSaveErrorRef.current?.(
          error instanceof Error ? error : new Error(String(error)),
        )
      } finally {
        isSavingRef.current = false

        const pendingContent = pendingContentRef.current
        pendingContentRef.current = null

        if (pendingContent !== null && projectId && fileId) {
          void runSave(pendingContent)
        }
      }
    },
    [fileId, projectId, saveFileContent],
  )

  const save = useCallback(
    (payload: AutosavePayload) => {
      const { content } = payload

      if (timeoutRef.current) clearTimeout(timeoutRef.current)

      if (!projectId || !fileId) return

      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null
        void runSave(content)
      }, duration)
    },
    [duration, fileId, projectId, runSave],
  )

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

type DiffSavePayload = {
  oldText: string
  newText: string
  baseRevision: number
}

export function useDiffSave({
  duration,
  projectId,
  fileId,
  onSaveComplete,
  onSaveError,
}: UseAutosaveOptions) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isSavingRef = useRef(false)
  const pendingContentRef = useRef<string | null>(null)
  const pendingRevisionRef = useRef<number | null>(null)
  const shadowContentRef = useRef<string | null>(null)
  const shadowRevisionRef = useRef<number | null>(null)
  const saveRequestIdRef = useRef(0)
  const onSaveCompleteRef = useRef(onSaveComplete)
  const onSaveErrorRef = useRef(onSaveError)
  const workerRef = useRef<Worker | null>(null)

  const { mutateAsync: saveFileContentDiff } = useMutation(
    saveFileContentDiffMutationOptions(projectId, fileId),
  )

  useEffect(() => {
    workerRef.current = new DiffWorker()

    return () => {
      saveRequestIdRef.current += 1
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [])

  useEffect(() => {
    shadowContentRef.current = null
    shadowRevisionRef.current = null
    pendingContentRef.current = null
    pendingRevisionRef.current = null
  }, [fileId, projectId])

  onSaveCompleteRef.current = onSaveComplete
  onSaveErrorRef.current = onSaveError

  const runSave = useCallback(
    async (
      content: string,
      fallbackBaseContent: string,
      fallbackBaseRevision: number,
    ) => {
      if (isSavingRef.current) {
        pendingContentRef.current = content
        pendingRevisionRef.current = fallbackBaseRevision
        return
      }

      isSavingRef.current = true
      try {
        const baseContent = shadowContentRef.current ?? fallbackBaseContent
        const baseRevision = shadowRevisionRef.current ?? fallbackBaseRevision
        const diff = await getPatchFromWorker(
          workerRef.current,
          baseContent,
          content,
        )

        if (!diff) return

        const savedContent = await saveFileContentDiff({ diff, baseRevision })
        shadowContentRef.current = content
        shadowRevisionRef.current = savedContent.revision
        onSaveCompleteRef.current?.()
      } catch (error) {
        onSaveErrorRef.current?.(
          error instanceof Error ? error : new Error(String(error)),
        )
      } finally {
        isSavingRef.current = false

        const pendingContent = pendingContentRef.current
        const pendingRevision = pendingRevisionRef.current
        pendingContentRef.current = null
        pendingRevisionRef.current = null

        if (
          pendingContent !== null &&
          pendingRevision !== null &&
          projectId &&
          fileId
        ) {
          void runSave(
            pendingContent,
            shadowContentRef.current ?? fallbackBaseContent,
            shadowRevisionRef.current ?? pendingRevision,
          )
        }
      }
    },
    [fileId, projectId, saveFileContentDiff],
  )

  const save = useCallback(
    (payload: DiffSavePayload) => {
      const { oldText, newText, baseRevision } = payload

      if (timeoutRef.current) clearTimeout(timeoutRef.current)

      const requestId = saveRequestIdRef.current + 1
      saveRequestIdRef.current = requestId

      if (!projectId || !fileId) return

      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null

        if (requestId !== saveRequestIdRef.current) return

        void runSave(newText, oldText, baseRevision)
      }, duration)
    },
    [duration, fileId, projectId, runSave],
  )

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

type DiffWorkerResponse = {
  messageId: number
  diff?: CompactTextDiff | null
  success: boolean
  error?: string
}

function getPatchFromWorker(
  worker: Worker | null,
  shadow: string,
  current: string,
): Promise<CompactTextDiff | null> {
  return new Promise((resolve, reject) => {
    if (!worker) {
      reject(new Error('Worker not initialized'))
      return
    }

    const messageId = Date.now() + Math.random()

    const cleanup = () => {
      clearTimeout(timeoutId)
      worker.removeEventListener('message', handleMessage)
      worker.removeEventListener('error', handleError)
    }

    const handleMessage = (event: MessageEvent<DiffWorkerResponse>) => {
      if (event.data.messageId !== messageId) return

      cleanup()

      if (event.data.success) {
        resolve(event.data.diff ?? null)
        return
      }

      reject(new Error(event.data.error ?? 'Failed to create diff patch'))
    }

    const handleError = (event: ErrorEvent) => {
      cleanup()
      reject(
        event.error instanceof Error ? event.error : new Error(event.message),
      )
    }

    const timeoutId = setTimeout(() => {
      cleanup()
      reject(new Error('Diff worker timed out'))
    }, 10_000)

    worker.addEventListener('message', handleMessage)
    worker.addEventListener('error', handleError)
    worker.postMessage({ oldText: shadow, newText: current, messageId })
  })
}
