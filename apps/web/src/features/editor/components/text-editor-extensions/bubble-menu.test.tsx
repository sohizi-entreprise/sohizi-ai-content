// @vitest-environment jsdom
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useEditorInputBridge } from "../../bridge/use-editor-input-bridge"
import { uiBlockExtensions } from "../../extensions/ui-blocks"
import { useEditorStore } from "../../stores/editor-store"
import TextEditorToolbar from "../content/text-editor-toolbar"
import TextEditorBubbleMenu, {
  detectAtomicSelection,
  getTextFieldSelectionRect,
  isAtomicDomNode,
  isAtomicEditorSelection,
} from "./bubble-menu"
import type { Editor } from "@tiptap/react"
import { buildAttachedSelection } from "@/features/chat/lib/editor-context"

const TEST_FILE = {
  id: "file-1",
  name: "brief.md",
  format: "markdown",
  path: "/root/brief.md",
}

function TestEditorHost({
  content = "<p>Hello world from editor</p>",
  onEditor,
}: {
  content?: string
  onEditor?: (editor: Editor) => void
}) {
  const editor = useEditor({
    immediatelyRender: true,
    extensions: [StarterKit, ...uiBlockExtensions],
    content,
  })

  if (onEditor) {
    onEditor(editor)
  }

  return (
    <div>
      <EditorContent editor={editor} />
      <TextEditorBubbleMenu
        editor={editor}
        scrollContainer={null}
        file={TEST_FILE}
      />
    </div>
  )
}

describe("TextEditorToolbar & TextEditorBubbleMenu", () => {
  beforeEach(() => {
    Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 100, 20)
    Range.prototype.getClientRects = () =>
      [new DOMRect(0, 0, 100, 20)] as unknown as DOMRectList
    useEditorInputBridge.getState().reset()
    useEditorStore.setState({
      chatOpenByContext: {
        "file-system": true,
        "media-generator": true,
      },
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("does not treat a fully selected heading or paragraph as an atomic selection", () => {
    let editorInstance: Editor | null = null
    render(
      <TestEditorHost
        content="<h1>Hello World Title</h1><p>Paragraph text here</p>"
        onEditor={(ed) => {
          editorInstance = ed
        }}
      />,
    )

    expect(editorInstance).not.toBeNull()
    const editor = editorInstance!

    act(() => {
      // Select the entire heading text node.
      editor.commands.setTextSelection({ from: 1, to: 18 })
    })
    expect(editor.state.doc.textBetween(1, 18)).toBe("Hello World Title")
    expect(isAtomicEditorSelection(editor)).toBe(false)

    act(() => {
      editor.commands.setTextSelection({ from: 20, to: 39 })
    })
    expect(editor.state.doc.textBetween(20, 39)).toBe("Paragraph text here")
    expect(isAtomicEditorSelection(editor)).toBe(false)
  })

  it("removes the Insert (+) button from TextEditorToolbar while keeping formatting options", () => {
    let editorInstance: Editor | null = null
    render(
      <TestEditorHost
        onEditor={(ed) => {
          editorInstance = ed
        }}
      />,
    )

    expect(editorInstance).not.toBeNull()
    const { container } = render(<TextEditorToolbar editor={editorInstance!} />)

    expect(container.querySelector('button[title="Insert"]')).toBeNull()
    expect(container.querySelector('button[title="Heading 1"]')).not.toBeNull()
    expect(container.querySelector('button[title="Bold"]')).not.toBeNull()
    expect(container.querySelector('button[title="List items"]')).not.toBeNull()
    expect(container.querySelector('button[title="Align text"]')).not.toBeNull()
  })

  it("shows a chevron on list and text-alignment toolbar triggers to indicate sub-menus", () => {
    let editorInstance: Editor | null = null
    render(
      <TestEditorHost
        onEditor={(ed) => {
          editorInstance = ed
        }}
      />,
    )

    expect(editorInstance).not.toBeNull()
    const { container } = render(<TextEditorToolbar editor={editorInstance!} />)

    const listTrigger = container.querySelector('button[title="List items"]')
    const alignTrigger = container.querySelector('button[title="Align text"]')
    const boldTrigger = container.querySelector('button[title="Bold"]')

    expect(listTrigger?.querySelectorAll("svg")).toHaveLength(2)
    expect(alignTrigger?.querySelectorAll("svg")).toHaveLength(2)
    expect(boldTrigger?.querySelectorAll("svg")).toHaveLength(1)
  })

  it("renders 'Feed Koli' with the mascot instead of '@ Add to context' in the bubble menu", () => {
    vi.useFakeTimers()
    let editorInstance: Editor | null = null
    render(
      <TestEditorHost
        onEditor={(ed) => {
          editorInstance = ed
        }}
      />,
    )

    expect(editorInstance).not.toBeNull()
    act(() => {
      editorInstance!.view.dom.focus()
      editorInstance!.commands.focus()
      editorInstance!.commands.setTextSelection({ from: 1, to: 6 })
      vi.advanceTimersByTime(300)
    })

    expect(screen.getByText("Feed Koli")).toBeTruthy()
    expect(screen.queryByText(/add to context/i)).toBeNull()
    vi.useRealTimers()
  })

  it("displays a toolbar with only 'Feed Koli' when text inside an atomic component input is selected and attaches it to chat", async () => {
    let editorInstance: Editor | null = null
    const runCommandSpy = vi.fn()
    useEditorInputBridge.setState({ runCommand: runCommandSpy })

    render(
      <TestEditorHost
        onEditor={(ed) => {
          editorInstance = ed
        }}
      />,
    )

    expect(editorInstance).not.toBeNull()
    await act(async () => {
      editorInstance!.commands.insertAttributesBlock({
        title: "Creative Direction",
        items: [
          {
            label: "Visual Style",
            value: "1970s neo-noir cinematography",
          },
        ],
      })
      await Promise.resolve()
    })

    const titleInput = screen.getByDisplayValue("Creative Direction")
    expect(isAtomicDomNode(titleInput, editorInstance!.view.dom)).toBe(true)

    await act(async () => {
      titleInput.focus()
      titleInput.setSelectionRange(0, 8)
      fireEvent.select(titleInput)
      await Promise.resolve()
    })

    const atomicToolbar = document.querySelector("[data-atomic-bubble-menu]")
    expect(atomicToolbar).not.toBeNull()
    expect(atomicToolbar?.textContent).toBe("Feed Koli")
    expect(atomicToolbar?.querySelector('button[title="Heading 1"]')).toBeNull()
    expect(atomicToolbar?.querySelector('button[title="Bold"]')).toBeNull()

    const feedKoliBtn = atomicToolbar?.querySelector("button")
    expect(feedKoliBtn).not.toBeNull()

    act(() => {
      fireEvent.click(feedKoliBtn!)
    })

    expect(runCommandSpy).toHaveBeenCalledTimes(1)
    expect(runCommandSpy).toHaveBeenCalledWith({
      type: "insertMention",
      mention: {
        displayName: "brief.md",
        path: "/root/brief.md",
        selection: expect.objectContaining({
          selectedText: "Creative",
          isEntireFile: false,
        }),
      },
    })
    expect(document.querySelector("[data-atomic-bubble-menu]")).toBeNull()
  })

  it("detects DOM Range selections inside contenteditable='false' atomic components", async () => {
    let editorInstance: Editor | null = null
    render(
      <TestEditorHost
        onEditor={(ed) => {
          editorInstance = ed
        }}
      />,
    )

    expect(editorInstance).not.toBeNull()
    await act(async () => {
      editorInstance!.commands.insertTimelineBlock({
        title: "Story Arc",
        items: [
          {
            duration: "8s",
            label: "Opening scene",
            scene: "scene-01",
          },
        ],
      })
      await Promise.resolve()
    })

    const narrativeLabel = screen.getByText(/Narrative timeline/i)
    const textNode = narrativeLabel.firstChild
    expect(textNode).not.toBeNull()

    const selection = window.getSelection()!
    const range = document.createRange()
    range.selectNodeContents(narrativeLabel)
    selection.removeAllRanges()
    selection.addRange(range)

    const detected = detectAtomicSelection(editorInstance!)
    expect(detected).not.toBeNull()
    expect(detected?.text).toContain("Narrative timeline")

    selection.removeAllRanges()
  })

  it("getTextFieldSelectionRect anchors to the selected substring instead of the full control", () => {
    const input = document.createElement("input")
    input.type = "text"
    input.value = "Creative Direction for the scene"
    document.body.appendChild(input)
    input.focus()
    input.setSelectionRange(0, 8) // "Creative"

    const originalGetBoundingClientRect =
      HTMLElement.prototype.getBoundingClientRect
    HTMLElement.prototype.getBoundingClientRect =
      function getBoundingClientRect() {
        if (this === input) {
          return new DOMRect(100, 200, 480, 40)
        }
        if (
          this instanceof HTMLSpanElement &&
          this.textContent === "Creative"
        ) {
          // Selection marker inside the offscreen mirror (origin 0,0).
          return new DOMRect(12, 8, 70, 16)
        }
        if (this instanceof HTMLDivElement) {
          // Mirror container at fixed (0,0).
          return new DOMRect(0, 0, 480, 40)
        }
        return originalGetBoundingClientRect.call(this)
      }

    try {
      const selectionRect = getTextFieldSelectionRect(input)
      expect(selectionRect).toEqual(new DOMRect(112, 208, 70, 16))
      expect(selectionRect.width).toBeLessThan(480)
    } finally {
      HTMLElement.prototype.getBoundingClientRect =
        originalGetBoundingClientRect
      document.body.removeChild(input)
    }
  })

  it("detectAtomicSelection exposes selection offsets so the toolbar repositions within the same field", async () => {
    let editorInstance: Editor | null = null
    render(
      <TestEditorHost
        onEditor={(ed) => {
          editorInstance = ed
        }}
      />,
    )

    expect(editorInstance).not.toBeNull()
    await act(async () => {
      editorInstance!.commands.insertAttributesBlock({
        title: "Creative Direction",
        items: [{ label: "Visual Style", value: "1970s neo-noir" }],
      })
      await Promise.resolve()
    })

    const titleInput = screen.getByDisplayValue("Creative Direction")

    await act(async () => {
      titleInput.focus()
      titleInput.setSelectionRange(0, 8)
      fireEvent.select(titleInput)
      await Promise.resolve()
    })

    const first = detectAtomicSelection(editorInstance!)
    expect(first).not.toBeNull()
    expect(first?.selectionStart).toBe(0)
    expect(first?.selectionEnd).toBe(8)
    expect(first?.text).toBe("Creative")
    expect(typeof first?.getRect).toBe("function")

    titleInput.setSelectionRange(9, 18) // "Direction"
    const second = detectAtomicSelection(editorInstance!)
    expect(second).not.toBeNull()
    expect(second?.selectionStart).toBe(9)
    expect(second?.selectionEnd).toBe(18)
    expect(second?.text).toBe("Direction")
  })

  it("buildAttachedSelection uses explicit selectedText when provided for atomic nodes", () => {
    let editorInstance: Editor | null = null
    render(
      <TestEditorHost
        content="<p>Introductory paragraph</p><p>Closing paragraph</p>"
        onEditor={(ed) => {
          editorInstance = ed
        }}
      />,
    )

    const result = buildAttachedSelection({
      editor: editorInstance!,
      file: TEST_FILE,
      from: 24,
      to: 24,
      selectedText: "Atomic block excerpt",
    })

    expect(result).toEqual({
      file: "[brief.md](/root/brief.md)",
      startLine: 1,
      endLine: 1,
      selectedText: "Atomic block excerpt",
      isEntireFile: false,
      textBefore: "Introductory paragraph",
      textAfter: "Closing paragraph",
    })
  })
})
