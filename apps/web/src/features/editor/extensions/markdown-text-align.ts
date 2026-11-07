import { Extension } from "@tiptap/core"
import {
  TEXT_ALIGN_FENCES,
  coalesceAlignedFences,
  findAlignBlockStart,
  matchAlignBlock,
} from "./ui-blocks/markdown-utils"
import type { TextAlignFence } from "./ui-blocks/markdown-utils"
import type { JSONContent, RenderContext } from "@tiptap/react"

const EMPTY_PARAGRAPH_MARKDOWN = "&nbsp;"
const NBSP_CHAR = "\u00A0"

type MarkdownRenderHelpers = {
  renderChildren: (
    nodes: Array<JSONContent> | JSONContent,
    separator?: string,
  ) => string
}

function getFenceAlign(node: JSONContent): TextAlignFence | null {
  const textAlign = node.attrs?.textAlign
  if (
    typeof textAlign === "string" &&
    (TEXT_ALIGN_FENCES as ReadonlyArray<string>).includes(textAlign)
  ) {
    return textAlign as TextAlignFence
  }
  return null
}

function applyTextAlignToNodes(
  nodes: Array<JSONContent>,
  align: TextAlignFence,
): Array<JSONContent> {
  return nodes.map((node) => {
    if (node.type === "paragraph" || node.type === "heading") {
      return {
        ...node,
        attrs: {
          ...node.attrs,
          textAlign: align,
        },
      }
    }
    return node
  })
}

const AlignContainerMarkdown = Extension.create({
  name: "alignContainerMarkdown",

  markdownTokenizer: {
    name: "alignContainerMarkdown",
    level: "block",
    start: (src: string) => findAlignBlockStart(src),
    tokenize: (
      src: string,
      _tokens: unknown,
      helper: { blockTokens: (src: string) => Array<unknown> },
    ) => {
      const matched = matchAlignBlock(src)
      if (!matched) return undefined
      const childTokens = matched.bodyMarkdown
        ? helper.blockTokens(matched.bodyMarkdown)
        : []
      return {
        type: "alignContainerMarkdown",
        raw: matched.raw,
        align: matched.align,
        tokens: childTokens,
      }
    },
  },

  parseMarkdown: (token, helpers) => {
    const rawAlign = typeof token.align === "string" ? token.align : ""
    const align: TextAlignFence = rawAlign === "right" ? "right" : "center"

    const helperWithBlockChildren = helpers as typeof helpers & {
      parseBlockChildren?: (tokens: Array<unknown>) => Array<JSONContent>
    }
    const rawChildren = token.tokens
      ? helperWithBlockChildren.parseBlockChildren
        ? helperWithBlockChildren.parseBlockChildren(token.tokens)
        : helpers.parseChildren(token.tokens)
      : []

    const children =
      Array.isArray(rawChildren) && rawChildren.length > 0
        ? rawChildren
        : [{ type: "paragraph" }]

    return applyTextAlignToNodes(children, align)
  },
})

const AlignedParagraphMarkdown = Extension.create({
  name: "alignedParagraphMarkdown",
  // Outrank StarterKit's paragraph so text-align fence serialization wins.
  priority: 1001,
  markdownTokenName: "paragraph",

  parseMarkdown(token, helpers) {
    const tokens = token.tokens ?? []
    if (tokens.length === 1 && tokens[0]?.type === "image") {
      return helpers.parseChildren([tokens[0]])
    }
    const content = helpers.parseInline(tokens)
    if (
      tokens.length === 1 &&
      tokens[0]?.type === "text" &&
      (tokens[0].raw === EMPTY_PARAGRAPH_MARKDOWN ||
        tokens[0].text === EMPTY_PARAGRAPH_MARKDOWN ||
        tokens[0].raw === NBSP_CHAR ||
        tokens[0].text === NBSP_CHAR) &&
      content.length === 1 &&
      content[0]?.type === "text" &&
      (content[0].text === EMPTY_PARAGRAPH_MARKDOWN ||
        content[0].text === NBSP_CHAR)
    ) {
      return helpers.createNode("paragraph", undefined, [])
    }
    return helpers.createNode("paragraph", undefined, content)
  },

  // TipTap's Document joins blocks with `\n\n` — do not append extra blank lines here.
  renderMarkdown(node, helpers: MarkdownRenderHelpers, ctx: RenderContext) {
    const content = Array.isArray(node.content) ? node.content : []

    if (content.length === 0) {
      const previousContent = Array.isArray(ctx.previousNode?.content)
        ? ctx.previousNode.content
        : []
      const previousNodeIsEmptyParagraph =
        ctx.previousNode?.type === "paragraph" && previousContent.length === 0
      return previousNodeIsEmptyParagraph ? EMPTY_PARAGRAPH_MARKDOWN : ""
    }

    const body = helpers.renderChildren(content)
    const align = getFenceAlign(node)
    if (!align) {
      return body
    }

    return `:::${align}\n${body}\n:::`
  },
})

const AlignedHeadingMarkdown = Extension.create({
  name: "alignedHeadingMarkdown",
  priority: 1001,
  markdownTokenName: "heading",

  parseMarkdown(token, helpers) {
    return helpers.createNode(
      "heading",
      { level: token.depth || 1 },
      helpers.parseInline(token.tokens ?? []),
    )
  },

  renderMarkdown(node, helpers: MarkdownRenderHelpers) {
    const level = Number(node.attrs?.level ?? 1)
    const content = Array.isArray(node.content) ? node.content : []
    if (content.length === 0) return ""

    const body = `${"#".repeat(level)} ${helpers.renderChildren(content)}`
    const align = getFenceAlign(node)
    if (!align) {
      return body
    }

    return `:::${align}\n${body}\n:::`
  },
})

const AlignedDocMarkdown = Extension.create({
  name: "alignedDocMarkdown",
  priority: 1001,
  markdownTokenName: "doc",

  parseMarkdown: () => null,

  renderMarkdown(node, helpers: MarkdownRenderHelpers) {
    if (!node.content) return ""
    return coalesceAlignedFences(helpers.renderChildren(node.content, "\n\n"))
  },
})

export const MarkdownTextAlign = Extension.create({
  name: "markdownTextAlign",

  addExtensions() {
    return [
      AlignContainerMarkdown,
      AlignedParagraphMarkdown,
      AlignedHeadingMarkdown,
      AlignedDocMarkdown,
    ]
  },
})
