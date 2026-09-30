import { Editor } from "@tiptap/core"
import { afterEach, describe, expect, it } from "vitest"
import {
  createSkillContent,
  skillEditorExtensions,
} from "./skill-editor-view"

const editors: Array<Editor> = []

function createEditor(instruction = "") {
  const editor = new Editor({
    element: document.createElement("div"),
    extensions: skillEditorExtensions,
    content: createSkillContent({ instruction }),
  })
  editors.push(editor)
  return editor
}

function listItemCount(editor: Editor) {
  let count = 0
  editor.state.doc.descendants((node) => {
    if (node.type.name === "listItem") count += 1
  })
  return count
}

function selectionAtEndOfText(editor: Editor, text: string) {
  let found = -1
  editor.state.doc.descendants((node, pos) => {
    if (node.isText && node.text === text) {
      found = pos + text.length
      return false
    }
    return true
  })
  return found
}

afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors.length = 0
})

describe("skill editor lists", () => {
  it("splits a bullet when Enter is pressed", () => {
    const editor = createEditor("- First item")
    const pos = selectionAtEndOfText(editor, "First item")

    expect(pos).toBeGreaterThan(0)
    expect(listItemCount(editor)).toBe(1)

    editor.commands.setTextSelection(pos)
    expect(() => editor.commands.keyboardShortcut("Enter")).not.toThrow()

    expect(listItemCount(editor)).toBe(2)
    expect(
      editor.view.dom
        .querySelector('[data-type="skill-instruction"] li p.is-empty')
        ?.getAttribute("data-placeholder"),
    ).toBe("Write instructions or use / command...")
  })

  it("lifts an empty bullet when Enter is pressed", () => {
    const editor = createEditor("- First item")
    const pos = selectionAtEndOfText(editor, "First item")
    editor.commands.setTextSelection(pos)
    editor.commands.keyboardShortcut("Enter")

    const emptyItem = editor.view.dom.querySelector(
      '[data-type="skill-instruction"] li p.is-empty',
    )
    expect(emptyItem).toBeTruthy()

    editor.commands.keyboardShortcut("Enter")

    expect(listItemCount(editor)).toBe(1)
  })

  it("shows the description placeholder on an empty skill", () => {
    const editor = createEditor("")

    expect(
      editor.view.dom
        .querySelector('[data-type="skill-description"] p')
        ?.getAttribute("data-placeholder"),
    ).toBe("Describe what this skill does...")
  })
})
