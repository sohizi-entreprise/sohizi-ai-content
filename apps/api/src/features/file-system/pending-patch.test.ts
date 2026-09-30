import { describe, expect, it } from "bun:test"
import { preservePatchBaseContent } from "./pending-patch"
import type { FilePendingOperation } from "@/type"

function patch(
  overrides: Partial<Extract<FilePendingOperation, { type: "patch" }>> = {},
): FilePendingOperation {
  return {
    type: "patch",
    content: "proposed",
    baseContent: "original",
    fileId: "file-1",
    fileName: "notes",
    ...overrides,
  }
}

describe("preservePatchBaseContent", () => {
  it("keeps the first accepted snapshot across later proposals", () => {
    const result = preservePatchBaseContent(
      patch({ content: "second proposal", baseContent: "second proposal" }),
      patch({ content: "first proposal", baseContent: "original" }),
    )

    expect(result).toEqual(
      patch({ content: "second proposal", baseContent: "original" }),
    )
  })

  it("uses the incoming snapshot when no prior patch exists", () => {
    expect(preservePatchBaseContent(patch(), null)).toEqual(patch())
  })

  it("does not rewrite non-patch operations", () => {
    const refresh: FilePendingOperation = {
      type: "refresh",
      fileId: "file-1",
      fileName: "notes",
    }

    expect(preservePatchBaseContent(refresh, patch())).toEqual(refresh)
  })
})
