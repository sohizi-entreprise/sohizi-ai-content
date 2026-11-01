// @vitest-environment jsdom
import { createElement } from "react"
import { render } from "@testing-library/react"
import { Editor } from "@tiptap/core"
import { Markdown, MarkdownManager } from "@tiptap/markdown"
import StarterKit from "@tiptap/starter-kit"
import { describe, expect, it } from "vitest"
import { ClipTag, replaceClipTagsWithLinks, toClipId } from "./clip-tag"
import { MessageResponse } from "@/components/ai-elements/message"

const SAMPLE_CLIP_ID = "26a43f06-275d-4e77-9c2d-8fff2572ca91"
const SAMPLE_CLIP_TAG = `[clip:${SAMPLE_CLIP_ID}]`

describe("ClipTag extension", () => {
  it("formats inserted [clip:<uuid>] text into a full-round badge labeled 'clip' and serializes back to markdown", () => {
    const editor = new Editor({
      extensions: [
        StarterKit.configure({
          blockquote: false,
          bulletList: false,
          code: false,
          codeBlock: false,
          dropcursor: false,
          gapcursor: false,
          heading: false,
          horizontalRule: false,
          italic: false,
          listItem: false,
          orderedList: false,
          strike: false,
          bold: false,
          link: false,
        }),
        ClipTag,
        Markdown.configure({
          markedOptions: { gfm: true },
        }),
      ],
      content: "",
      contentType: "markdown",
    })

    editor.chain().insertContent(`Edit ${SAMPLE_CLIP_TAG} now`).run()

    const badgeEl = editor.view.dom.querySelector(
      'span[data-type="clipTag"]',
    ) as HTMLElement | null
    expect(badgeEl).not.toBeNull()
    expect(badgeEl?.textContent).toBe("clip")
    expect(badgeEl?.getAttribute("data-clip-id")).toBe(SAMPLE_CLIP_ID)
    expect(badgeEl?.className).toContain("rounded-full")

    expect(editor.getMarkdown().trim()).toBe(`Edit ${SAMPLE_CLIP_TAG} now`)

    editor.destroy()
  })

  it("formats pasted plain text containing [clip:<uuid>] into a badge", () => {
    const editor = new Editor({
      extensions: [
        StarterKit,
        ClipTag,
        Markdown.configure({
          markedOptions: { gfm: true },
        }),
      ],
      content: "",
    })

    editor.view.dispatch(editor.state.tr.insertText(SAMPLE_CLIP_TAG))

    const badgeEl = editor.view.dom.querySelector(
      'span[data-type="clipTag"]',
    ) as HTMLElement | null
    expect(badgeEl).not.toBeNull()
    expect(badgeEl?.textContent).toBe("clip")
    expect(badgeEl?.className).toContain("rounded-full")
    expect(editor.getMarkdown().trim()).toBe(SAMPLE_CLIP_TAG)

    editor.destroy()
  })

  it("round-trips [clip:<uuid>] through MarkdownManager", () => {
    const manager = new MarkdownManager({
      extensions: [StarterKit, ClipTag],
      markedOptions: { gfm: true },
    })

    const doc = manager.parse(`Trim ${SAMPLE_CLIP_TAG} please`)
    const serialized = manager.serialize(doc)
    expect(serialized.trim()).toBe(`Trim ${SAMPLE_CLIP_TAG} please`)
  })

  it("converts [clip:<uuid>] to markdown links and renders the clip badge in MessageResponse", () => {
    const transformed = replaceClipTagsWithLinks(
      `Check ${SAMPLE_CLIP_TAG} here`,
    )
    expect(transformed).toBe(`Check [clip](/clip/${SAMPLE_CLIP_ID}) here`)
    expect(toClipId(`/clip/${SAMPLE_CLIP_ID}`)).toBe(SAMPLE_CLIP_ID)
    expect(toClipId("/root/video.mp4")).toBeNull()

    const { container } = render(
      createElement(MessageResponse, null, `Check ${SAMPLE_CLIP_TAG} here`),
    )
    const badgeEl = container.querySelector(
      'span[data-type="clipTag"]',
    ) as HTMLElement | null
    expect(badgeEl).not.toBeNull()
    expect(badgeEl?.textContent).toBe("clip")
    expect(badgeEl?.getAttribute("data-clip-id")).toBe(SAMPLE_CLIP_ID)
    expect(badgeEl?.className).toContain("rounded-full")
  })
})
