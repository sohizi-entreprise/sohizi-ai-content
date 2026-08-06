import { useCallback, useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getFileContentQueryOptions,
  saveFileContentDiffMutationOptions,
  saveFileContentMutationOptions,
} from '../query-mutations'
import { useEditorStore } from '../stores/editor-store'
import { saveSkill as saveSkillRequest } from '../requests'
import type { CompactTextDiff } from '../requests'
import type { SaveSkillPayload } from '../requests'
import DiffWorker from '@/lib/workers/diff-worker?worker'

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
  const setSavingStatus = useEditorStore((s) => s.setSavingStatus)
  const { mutateAsync: saveFileContent } = useMutation(
    saveFileContentMutationOptions(projectId, fileId),
  )

  onSaveCompleteRef.current = onSaveComplete
  onSaveErrorRef.current = onSaveError

  const runSave = useCallback(
    async (content: string, diffApplied?: boolean) => {
      if (isSavingRef.current) {
        pendingContentRef.current = content
        return
      }

      isSavingRef.current = true
      try {
        await saveFileContent({ content, diffApplied })
        onSaveCompleteRef.current?.()
        setSavingStatus(fileId, 'saved')
      } catch (error) {
        setSavingStatus(fileId, 'error')
        onSaveErrorRef.current?.(
          error instanceof Error ? error : new Error(String(error)),
        )
      } finally {
        isSavingRef.current = false

        const pendingContent = pendingContentRef.current
        pendingContentRef.current = null

        if (pendingContent !== null && projectId && fileId) {
          void runSave(pendingContent, diffApplied)
        }
      }
    },
    [fileId, projectId, saveFileContent, setSavingStatus],
  )

  const save = useCallback(
    (payload: AutosavePayload) => {
      const { content, diffApplied } = payload

      if (timeoutRef.current) clearTimeout(timeoutRef.current)

      if (!projectId || !fileId) return

      setSavingStatus(fileId, 'saving')

      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null
        void runSave(content, diffApplied)
      }, duration)
    },
    [duration, fileId, projectId, runSave, setSavingStatus],
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

/** Pass a getter so callers can defer expensive serialization until the debounce fires. */
export type SkillAutosaveInput = SaveSkillPayload | (() => SaveSkillPayload)

function resolveSkillAutosaveInput(skill: SkillAutosaveInput): SaveSkillPayload {
  return typeof skill === 'function' ? skill() : skill
}

export function useSkillAutosave({
  duration,
  projectId,
  fileId,
  onSaveComplete,
  onSaveError,
}: UseAutosaveOptions) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isSavingRef = useRef(false)
  const pendingSkillRef = useRef<SaveSkillPayload | null>(null)
  const latestSkillRef = useRef<SkillAutosaveInput | null>(null)
  const onSaveCompleteRef = useRef(onSaveComplete)
  const onSaveErrorRef = useRef(onSaveError)
  const fileIdRef = useRef(fileId)
  const projectIdRef = useRef(projectId)
  const queryClient = useQueryClient()
  const setSavingStatus = useEditorStore((s) => s.setSavingStatus)

  fileIdRef.current = fileId
  projectIdRef.current = projectId
  onSaveCompleteRef.current = onSaveComplete
  onSaveErrorRef.current = onSaveError

  const { mutateAsync: saveSkill } = useMutation({
    mutationFn: (skill: SaveSkillPayload) =>
      saveSkillRequest(projectIdRef.current, fileIdRef.current, skill),
    onSuccess: (data) => {
      queryClient.setQueryData(
        getFileContentQueryOptions(projectIdRef.current, fileIdRef.current)
          .queryKey,
        {
          type: 'skill' as const,
          data,
        },
      )
    },
  })

  const runSave = useCallback(
    async (skill: SaveSkillPayload) => {
      const activeFileId = fileIdRef.current
      const activeProjectId = projectIdRef.current

      if (isSavingRef.current) {
        pendingSkillRef.current = skill
        return
      }

      isSavingRef.current = true
      setSavingStatus(activeFileId, 'saving')
      try {
        await saveSkill(skill)
        onSaveCompleteRef.current?.()
        setSavingStatus(activeFileId, 'saved')
      } catch (error) {
        setSavingStatus(activeFileId, 'error')
        onSaveErrorRef.current?.(
          error instanceof Error ? error : new Error(String(error)),
        )
      } finally {
        isSavingRef.current = false

        const pendingSkill = pendingSkillRef.current
        pendingSkillRef.current = null

        if (pendingSkill !== null && activeProjectId && activeFileId) {
          void runSave(pendingSkill)
        }
      }
    },
    [saveSkill, setSavingStatus],
  )

  const save = useCallback(
    (skill: SkillAutosaveInput) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)

      const activeFileId = fileIdRef.current
      const activeProjectId = projectIdRef.current
      if (!activeProjectId || !activeFileId) return

      // Keep only a lightweight schedule on each keystroke; serialize when the timer fires.
      latestSkillRef.current = skill

      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null
        const pending = latestSkillRef.current
        latestSkillRef.current = null
        if (!pending) return
        void runSave(resolveSkillAutosaveInput(pending))
      }, duration)
    },
    [duration, runSave],
  )

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    pendingSkillRef.current = null
    latestSkillRef.current = null
  }, [fileId, projectId])

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

  const setSavingStatus = useEditorStore((s) => s.setSavingStatus)

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

        if (!diff) {
          setSavingStatus(fileId, 'saved')
          return
        }

        setSavingStatus(fileId, 'saving')
        const savedContent = await saveFileContentDiff({ diff, baseRevision })
        shadowContentRef.current = content
        shadowRevisionRef.current = savedContent.revision
        onSaveCompleteRef.current?.()
        setSavingStatus(fileId, 'saved')
      } catch (error) {
        setSavingStatus(fileId, 'error')
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
    [fileId, projectId, saveFileContentDiff, setSavingStatus],
  )

  const save = useCallback(
    (payload: DiffSavePayload) => {
      const { oldText, newText, baseRevision } = payload

      if (timeoutRef.current) clearTimeout(timeoutRef.current)

      const requestId = saveRequestIdRef.current + 1
      saveRequestIdRef.current = requestId

      if (!projectId || !fileId) return

      setSavingStatus(fileId, 'saving')

      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null

        if (requestId !== saveRequestIdRef.current) return

        void runSave(newText, oldText, baseRevision)
      }, duration)
    },
    [duration, fileId, projectId, runSave, setSavingStatus],
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
