import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  RejectMergeConflictError,
  getMarkdownChangeHunks,
} from "../diff-markdown"
import {
  getPendingBaseContent,
  getPendingOperationKey,
  getPendingPatchPayload,
  resolveRejectedMarkdown,
  shouldApplyPendingProposal,
} from "../pending-changes"
import {
  deletePendingOperationMutationOptions,
  getPendingOperationQueryOptions,
  saveFileContentMutationOptions,
} from "../query-mutations"
import type { AutosavePayload } from "./use-autosave"
import type { DiffHunk } from "../diff-markdown"
import type { PatchOperation, PendingFileOperation } from "../types"
import type { Editor } from "@tiptap/react"
import type { MutableRefObject } from "react"

type UsePendingMarkdownChangesOptions = {
  editor: Editor
  projectId: string
  fileId: string
  baseMarkdown: string
  autosave: (payload: AutosavePayload) => void
  setMarkdownContent: (editor: Editor, markdown: string) => void
  getMarkdown?: (editor: Editor) => string
  appliedDiffRef: MutableRefObject<boolean>
  isApplyingVisualDiffRef: MutableRefObject<boolean>
}

type UsePendingMarkdownChangesResult = {
  pendingOperation: PendingFileOperation | null
  pendingPatch: PatchOperation | null
  changeHunks: Array<DiffHunk>
  changesOpen: boolean
  setChangesOpen: (open: boolean | ((current: boolean) => boolean)) => void
  handleAcceptChanges: () => void
  handleRejectChanges: () => void
}

export function usePendingMarkdownChanges({
  editor,
  projectId,
  fileId,
  baseMarkdown,
  autosave,
  setMarkdownContent,
  getMarkdown = (current) => current.getMarkdown(),
  appliedDiffRef,
  isApplyingVisualDiffRef,
}: UsePendingMarkdownChangesOptions): UsePendingMarkdownChangesResult {
  const [changesOpen, setChangesOpen] = useState(false)
  const visualizedPendingKeyRef = useRef<string | null>(null)
  const appliedProposalRef = useRef<string | null>(null)

  const { data, isLoading: isLoadingPendingOperation } = useQuery(
    getPendingOperationQueryOptions(projectId, fileId),
  )
  const pendingOperation = data?.operation ?? null
  const pendingPatch = getPendingPatchPayload(pendingOperation)

  const { mutateAsync: saveFileContent } = useMutation(
    saveFileContentMutationOptions(projectId, fileId),
  )
  const { mutateAsync: deletePendingOperation } = useMutation(
    deletePendingOperationMutationOptions(projectId, fileId),
  )

  useEffect(() => {
    if (!pendingOperation) {
      visualizedPendingKeyRef.current = null
      appliedProposalRef.current = null
      appliedDiffRef.current = false
      setChangesOpen(false)
    }
  }, [appliedDiffRef, pendingOperation])

  useEffect(() => {
    if (!pendingOperation || isLoadingPendingOperation) return
    if (
      !shouldApplyPendingProposal(
        pendingOperation,
        visualizedPendingKeyRef.current,
      )
    ) {
      return
    }

    const payload = getPendingPatchPayload(pendingOperation)
    if (!payload) return

    visualizedPendingKeyRef.current = getPendingOperationKey(pendingOperation)
    isApplyingVisualDiffRef.current = true

    setMarkdownContent(editor, payload.content)
    appliedProposalRef.current = getMarkdown(editor)
    appliedDiffRef.current = true
    isApplyingVisualDiffRef.current = false

    autosave({
      content: getMarkdown(editor),
      diffApplied: true,
    })
  }, [
    appliedDiffRef,
    autosave,
    editor,
    getMarkdown,
    isApplyingVisualDiffRef,
    isLoadingPendingOperation,
    pendingOperation,
    setMarkdownContent,
  ])

  const changeHunks = useMemo(() => {
    if (!pendingPatch) return []

    const original = getPendingBaseContent(
      pendingPatch,
      pendingOperation && !pendingOperation.diffApplied
        ? baseMarkdown
        : undefined,
    )
    if (original === null) return []

    return getMarkdownChangeHunks(original, pendingPatch.content)
  }, [baseMarkdown, pendingOperation, pendingPatch])

  const resolvePendingChanges = useCallback(
    async (content: string) => {
      if (!pendingOperation) return

      isApplyingVisualDiffRef.current = true
      setMarkdownContent(editor, content)
      appliedDiffRef.current = false
      visualizedPendingKeyRef.current = null
      appliedProposalRef.current = null
      isApplyingVisualDiffRef.current = false
      setChangesOpen(false)

      try {
        await saveFileContent({ content })
        await deletePendingOperation()
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to save changes",
        )
        console.error(error)
      }
    },
    [
      appliedDiffRef,
      deletePendingOperation,
      editor,
      isApplyingVisualDiffRef,
      pendingOperation,
      saveFileContent,
      setMarkdownContent,
    ],
  )

  const handleAcceptChanges = useCallback(() => {
    void resolvePendingChanges(getMarkdown(editor))
  }, [editor, getMarkdown, resolvePendingChanges])

  const handleRejectChanges = useCallback(() => {
    if (!pendingPatch) return

    try {
      const rejected = resolveRejectedMarkdown({
        baseContent: getPendingBaseContent(
          pendingPatch,
          pendingOperation && !pendingOperation.diffApplied
            ? baseMarkdown
            : undefined,
        ),
        proposal: appliedProposalRef.current ?? pendingPatch.content,
        current: getMarkdown(editor),
      })
      void resolvePendingChanges(rejected)
    } catch (error) {
      toast.error(
        error instanceof RejectMergeConflictError
          ? error.message
          : "Failed to reject changes",
      )
    }
  }, [
    baseMarkdown,
    editor,
    getMarkdown,
    pendingOperation,
    pendingPatch,
    resolvePendingChanges,
  ])

  return {
    pendingOperation,
    pendingPatch,
    changeHunks,
    changesOpen,
    setChangesOpen,
    handleAcceptChanges,
    handleRejectChanges,
  }
}
