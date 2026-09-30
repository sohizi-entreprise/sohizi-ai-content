import { describe, expect, it } from "vitest"
import { RejectMergeConflictError } from "./diff-markdown"
import {
  getPendingBaseContent,
  getPendingOperationKey,
  getPendingPatchPayload,
  resolveRejectedMarkdown,
  shouldApplyPendingProposal,
} from "./pending-changes"
import type { PendingFileOperation } from "./types"

function pending(
  overrides: Partial<PendingFileOperation> = {},
): PendingFileOperation {
  return {
    id: "pending-1",
    fileNodeId: "file-1",
    operation: "patch",
    payload: {
      type: "patch",
      content: "proposed",
      baseContent: "original",
      fileId: "file-1",
      fileName: "notes",
    },
    diffApplied: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

describe("pending change helpers", () => {
  it("applies a new unapplied patch proposal once", () => {
    const operation = pending()

    expect(shouldApplyPendingProposal(operation, null)).toBe(true)
    expect(
      shouldApplyPendingProposal(operation, getPendingOperationKey(operation)),
    ).toBe(false)
    expect(
      shouldApplyPendingProposal({ ...operation, diffApplied: true }, null),
    ).toBe(false)
  })

  it("does not apply non-patch pending operations", () => {
    expect(
      shouldApplyPendingProposal(
        pending({
          operation: "refresh",
          payload: {
            type: "refresh",
            fileId: "file-1",
            fileName: "notes",
          },
        }),
        null,
      ),
    ).toBe(false)
    expect(
      getPendingPatchPayload(
        pending({
          operation: "delete",
          payload: {
            type: "delete",
            fileId: "file-1",
            fileName: "notes",
          },
        }),
      ),
    ).toBeNull()
  })

  it("prefers the stored base snapshot over the mount-time fallback", () => {
    expect(
      getPendingBaseContent(
        {
          type: "patch",
          content: "proposed",
          baseContent: "stored",
          fileId: "file-1",
          fileName: "notes",
        },
        "fallback",
      ),
    ).toBe("stored")
  })

  it("uses the fallback only for legacy pending rows", () => {
    expect(
      getPendingBaseContent(
        {
          type: "patch",
          content: "proposed",
          fileId: "file-1",
          fileName: "notes",
        },
        "fallback",
      ),
    ).toBe("fallback")
    expect(
      getPendingBaseContent({
        type: "patch",
        content: "proposed",
        fileId: "file-1",
        fileName: "notes",
      }),
    ).toBeNull()
  })

  it("rejects with a merge when possible and errors when the base is missing", () => {
    expect(
      resolveRejectedMarkdown({
        baseContent: "title\n\nbody\n",
        proposal: "title\n\nbody changed\n",
        current: "title edited\n\nbody changed\n",
      }),
    ).toBe("title edited\n\nbody\n")

    expect(() =>
      resolveRejectedMarkdown({
        baseContent: null,
        proposal: "proposed",
        current: "proposed",
      }),
    ).toThrow(RejectMergeConflictError)
  })
})
