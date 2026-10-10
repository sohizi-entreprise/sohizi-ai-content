import { useState } from "react"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FileGridMenu } from "./file-grid-menu"

afterEach(cleanup)

function ListFolderMenu() {
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(true)

  return (
    <FileGridMenu
      node={{ id: "folder", directory: true, editable: true, type: null }}
      parentType={null}
      disabled={editing}
      modal={false}
      onNewFolder={vi.fn()}
      onNewFile={vi.fn()}
      onInsert={vi.fn()}
      onRename={() => setEditing(true)}
      onDelete={vi.fn()}
      onUpload={vi.fn()}
    >
      <div>
        <button type="button" onClick={() => setExpanded(!expanded)}>
          {expanded ? "Open folder" : "Closed folder"}
        </button>
        {editing ? <input autoFocus aria-label="Folder name" /> : null}
      </div>
    </FileGridMenu>
  )
}

describe("list folder context menu", () => {
  it("stays open on an expanded folder and keeps focus in the rename input", async () => {
    render(<ListFolderMenu />)

    fireEvent.contextMenu(screen.getByRole("button", { name: "Open folder" }))
    const rename = await screen.findByRole("menuitem", { name: "Rename" })
    expect(rename).not.toBeNull()

    fireEvent.click(rename)
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("textbox", { name: "Folder name" }),
      ),
    )
    expect(screen.getByRole("button", { name: "Open folder" })).not.toBeNull()
  })
})
