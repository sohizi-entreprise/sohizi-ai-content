import type { FilePendingOperation, PatchOperation } from "@/type"

export function isPatchOperation(
  payload: FilePendingOperation | null | undefined,
): payload is PatchOperation {
  return payload?.type === "patch"
}

/**
 * The first pending patch owns the accepted document. Later AI edits must keep
 * that snapshot so reject/merge still targets the original markdown.
 */
export function preservePatchBaseContent(
  incoming: FilePendingOperation,
  existing: FilePendingOperation | null | undefined,
): FilePendingOperation {
  if (!isPatchOperation(incoming) || !isPatchOperation(existing)) {
    return incoming
  }

  if (typeof existing.baseContent !== "string") {
    return incoming
  }

  return {
    ...incoming,
    baseContent: existing.baseContent,
  }
}

export function getPendingEditContent(
  committedContent: string,
  pending: { payload: FilePendingOperation; diffApplied: boolean } | null,
): string {
  if (pending && !pending.diffApplied && isPatchOperation(pending.payload)) {
    return pending.payload.content
  }
  return committedContent
}
