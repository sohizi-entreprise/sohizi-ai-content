// @vitest-environment jsdom
import { createElement } from "react"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MarkdownDiffChangesPanel } from "./markdown-diff-changes-panel"
import type { DiffHunk } from "../../diff-markdown"

afterEach(() => {
  cleanup()
})

const hunks: Array<DiffHunk> = [
  { id: "hunk-1", deleted: "confident", inserted: "**confident**" },
]

describe("MarkdownDiffChangesPanel", () => {
  it("renders a word-level replacement as a deleted word then an inserted wrap", () => {
    render(
      createElement(MarkdownDiffChangesPanel, {
        open: true,
        onOpenChange: vi.fn(),
        hunks,
      }),
    )

    const deletion = screen.getByText("confident")
    const insertion = screen.getByText("**confident**")

    expect(deletion.className).toContain("markdown-diff-panel-item--delete")
    expect(insertion.className).toContain("markdown-diff-panel-item--insert")
    expect(
      deletion.compareDocumentPosition(insertion) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it("shows an empty state when there are no change hunks", () => {
    render(
      createElement(MarkdownDiffChangesPanel, {
        open: true,
        onOpenChange: vi.fn(),
        hunks: [],
      }),
    )

    expect(screen.getByText("No changes to review.")).toBeTruthy()
  })
})
