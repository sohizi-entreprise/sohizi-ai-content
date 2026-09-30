import {
  RejectMergeConflictError,
  rejectPendingMarkdown,
} from "./diff-markdown"
import type { PatchOperation, PendingFileOperation } from "./types"

export function getPendingOperationKey(operation: PendingFileOperation) {
  return `${operation.fileNodeId}:${operation.updatedAt}`
}

export function getPendingPatchPayload(
  operation: PendingFileOperation | null,
): PatchOperation | null {
  if (!operation || operation.payload.type !== "patch") {
    return null
  }

  return operation.payload
}

export function shouldApplyPendingProposal(
  operation: PendingFileOperation,
  visualizedKey: string | null,
): boolean {
  if (operation.diffApplied) return false
  if (operation.payload.type !== "patch") return false
  return visualizedKey !== getPendingOperationKey(operation)
}

export function getPendingBaseContent(
  payload: PatchOperation,
  fallback?: string,
): string | null {
  if (typeof payload.baseContent === "string") {
    return payload.baseContent
  }

  if (fallback !== undefined) {
    return fallback
  }

  return null
}

export function resolveRejectedMarkdown(args: {
  baseContent: string | null
  proposal: string
  current: string
}): string {
  if (args.baseContent === null) {
    throw new RejectMergeConflictError(
      "The original document is unavailable, so this suggestion cannot be rejected safely.",
    )
  }

  return rejectPendingMarkdown({
    baseContent: args.baseContent,
    proposal: args.proposal,
    current: args.current,
  })
}
