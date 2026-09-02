import { Editor } from "@tiptap/core"
import { Markdown, MarkdownManager } from "@tiptap/markdown"
import StarterKit from "@tiptap/starter-kit"
import { describe, expect, it } from "vitest"
import { acceptDiffMarkdown, asDiffMarkdown, buildDiff } from "./diff-markdown"
import { MarkdownDiffExtensions } from "./extensions/markdown-diff"

const extensions = [
  StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
  ...MarkdownDiffExtensions,
]

const manager = new MarkdownManager({
  extensions,
  markedOptions: { gfm: true },
})

function roundTrip(markdown: string) {
  return manager.serialize(manager.parse(markdown))
}

function collectTypes(node: {
  type?: string
  content?: Array<unknown>
}): Array<string> {
  const types: Array<string> = []
  const visit = (value: { type?: string; content?: Array<unknown> }) => {
    if (value.type) types.push(value.type)
    for (const child of value.content ?? []) {
      visit(child as { type?: string; content?: Array<unknown> })
    }
  }
  visit(node)
  return types
}

describe("diff markdown bold wrapping", () => {
  it("keeps {+**+}word{+**+} as inline inserts at the start of a document", () => {
    const parsed = manager.parse("{+**+}word{+**+}")
    const types = collectTypes(parsed)

    expect(types).not.toContain("additionDiffBlock")
    expect(parsed).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "**", marks: [{ type: "additionDiff" }] },
            { type: "text", text: "word" },
            { type: "text", text: "**", marks: [{ type: "additionDiff" }] },
          ],
        },
      ],
    })
  })

  it("still uses a block wrapper for headings, lists, and multi-line inserts", () => {
    expect(collectTypes(manager.parse("{+## Title+}\n"))).toContain(
      "additionDiffBlock",
    )
    expect(collectTypes(manager.parse("{+- item+}\n"))).toContain(
      "additionDiffBlock",
    )
    expect(collectTypes(manager.parse("{+## Title\n\nbody+}\n"))).toContain(
      "additionDiffBlock",
    )
  })

  it("parses a whole-line {+**word**+} insert as inline bold, not a block", () => {
    const parsed = manager.parse("{+**word**+}")
    const types = collectTypes(parsed)

    expect(types).not.toContain("additionDiffBlock")
    expect(parsed).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "word",
              marks: [{ type: "bold" }, { type: "additionDiff" }],
            },
          ],
        },
      ],
    })
  })

  it("accepts an italic wrap at the start of a document", () => {
    const diff = buildDiff("word", "*word*")
    const serialized = roundTrip(diff)

    expect(() => asDiffMarkdown(serialized)).not.toThrow()
    expect(acceptDiffMarkdown(asDiffMarkdown(serialized)).trim()).toBe("*word*")
  })

  it("accepts a bold wrap after an editor round-trip", () => {
    const diff = buildDiff("simple text", "**simple text**")
    const serialized = roundTrip(diff)

    expect(serialized.trim()).toBe("{+**+}simple text{+**+}")
    expect(acceptDiffMarkdown(asDiffMarkdown(serialized))).toBe(
      "**simple text**",
    )
  })

  it("accepts a last-paragraph bold wrap in a longer file", () => {
    const prefix = `${"lorem ipsum dolor sit amet. ".repeat(20).trim()}\n\n`
    const diff = buildDiff(`${prefix}simple text`, `${prefix}**simple text**`)
    const serialized = roundTrip(diff)

    expect(() => asDiffMarkdown(serialized)).not.toThrow()
    expect(acceptDiffMarkdown(asDiffMarkdown(serialized))).toBe(
      `${prefix}**simple text**`,
    )
  })

  it("accepts Editor.getMarkdown() after applying a bold wrap diff", () => {
    const prefix = `${"lorem ipsum dolor sit amet. ".repeat(20).trim()}\n\n`
    const diff = buildDiff(`${prefix}simple text`, `${prefix}**simple text**`)

    const editor = new Editor({
      extensions: [
        ...extensions,
        Markdown.configure({ markedOptions: { gfm: true } }),
      ],
      content: diff,
      contentType: "markdown",
    })

    const markdown = editor.getMarkdown()
    editor.destroy()

    expect(() => asDiffMarkdown(markdown)).not.toThrow()
    expect(acceptDiffMarkdown(asDiffMarkdown(markdown)).trim()).toBe(
      `${prefix}**simple text**`.trim(),
    )
  })
})
