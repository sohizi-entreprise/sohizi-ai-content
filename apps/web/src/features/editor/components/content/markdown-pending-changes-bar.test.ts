// @vitest-environment jsdom
import { createElement } from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MarkdownPendingChangesBar } from "./markdown-pending-changes-bar"

afterEach(() => {
  cleanup()
})

describe("MarkdownPendingChangesBar", () => {
  it("toggles the changes panel from the pending bar", () => {
    const onToggleChanges = vi.fn()

    render(
      createElement(MarkdownPendingChangesBar, {
        changesOpen: false,
        onToggleChanges,
        onAccept: vi.fn(),
        onReject: vi.fn(),
      }),
    )

    fireEvent.click(screen.getByRole("button", { name: "View changes" }))
    expect(onToggleChanges).toHaveBeenCalledTimes(1)
  })
})
