import { Extension, Node, mergeAttributes, type AnyExtension } from '@tiptap/core'
import type { JSONContent, RenderContext } from '@tiptap/react'
import { MarkdownManager } from '@tiptap/markdown'

const TEXT_ALIGN_VALUES = new Set(['left', 'center', 'right', 'justify'])
const EMPTY_PARAGRAPH_MARKDOWN = '&nbsp;'

type MarkdownTextAlignOptions = {
  headingLevels: Array<1 | 2 | 3 | 4 | 5 | 6>
}

type MarkdownRenderHelpers = {
  renderChildren: (nodes: JSONContent[] | JSONContent) => string
}

const MarkdownAlignedParagraph = Node.create({
  name: 'paragraph',
  // Outrank StarterKit's paragraph so text-align markdown wins during serialize.
  priority: 1001,
  group: 'block',
  content: 'inline*',

  parseHTML() {
    return [{ tag: 'p' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['p', mergeAttributes(HTMLAttributes), 0]
  },

  parseMarkdown(token, helpers) {
    return {
      type: 'paragraph',
      content: helpers.parseInline(token.tokens ?? []),
    }
  },

  // TipTap's Document joins blocks with `\n\n` — do not append extra blank lines here.
  renderMarkdown(node, helpers: MarkdownRenderHelpers, ctx: RenderContext) {
    const content = Array.isArray(node.content) ? node.content : []

    if (content.length === 0) {
      const previousContent = Array.isArray(ctx?.previousNode?.content)
        ? ctx.previousNode.content
        : []
      const previousNodeIsEmptyParagraph =
        ctx?.previousNode?.type === 'paragraph' && previousContent.length === 0
      return previousNodeIsEmptyParagraph ? EMPTY_PARAGRAPH_MARKDOWN : ''
    }

    const textAlign = getTextAlign(node)
    if (!textAlign) {
      return helpers.renderChildren(content)
    }

    return `<p style="text-align: ${textAlign}">${inlineContentToHtml(content)}</p>`
  },

  addCommands() {
    return {
      setParagraph:
        () =>
        ({ commands }) => {
          return commands.setNode(this.name)
        },
    }
  },
})

const MarkdownAlignedHeading = Node.create<MarkdownTextAlignOptions>({
  name: 'heading',
  priority: 1001,
  group: 'block',
  content: 'inline*',
  defining: true,

  addOptions() {
    return {
      headingLevels: [1, 2, 3, 4, 5, 6],
    }
  },

  addAttributes() {
    return {
      level: {
        default: 1,
        rendered: false,
      },
    }
  },

  parseHTML() {
    return this.options.headingLevels.map((level) => ({
      tag: `h${level}`,
      attrs: { level },
    }))
  },

  renderHTML({ node, HTMLAttributes }) {
    const level = this.options.headingLevels.includes(node.attrs.level)
      ? node.attrs.level
      : this.options.headingLevels[0]

    return [`h${level}`, mergeAttributes(HTMLAttributes), 0]
  },

  parseMarkdown(token, helpers) {
    return {
      type: 'heading',
      attrs: { level: token.depth },
      content: helpers.parseInline(token.tokens ?? []),
    }
  },

  renderMarkdown(node, helpers: MarkdownRenderHelpers) {
    const level = Number(node.attrs?.level ?? 1)
    const content = Array.isArray(node.content) ? node.content : []
    if (content.length === 0) return ''

    const textAlign = getTextAlign(node)
    if (!textAlign) {
      return `${'#'.repeat(level)} ${helpers.renderChildren(content)}`
    }

    const tagName = `h${Math.min(Math.max(level, 1), 6)}`
    return `<${tagName} style="text-align: ${textAlign}">${inlineContentToHtml(content)}</${tagName}>`
  },

  addCommands() {
    return {
      setHeading:
        (attributes: { level: 1 | 2 | 3 | 4 | 5 | 6 }) =>
        ({ commands }) => {
          if (!this.options.headingLevels.includes(attributes.level)) {
            return false
          }

          return commands.setNode(this.name, attributes)
        },
      toggleHeading:
        (attributes: { level: 1 | 2 | 3 | 4 | 5 | 6 }) =>
        ({ commands }) => {
          if (!this.options.headingLevels.includes(attributes.level)) {
            return false
          }

          return commands.toggleNode(this.name, 'paragraph', attributes)
        },
    }
  },
})

export const MarkdownTextAlign = Extension.create<MarkdownTextAlignOptions>({
  name: 'markdownTextAlign',

  addOptions() {
    return {
      headingLevels: [1, 2, 3, 4, 5, 6],
    }
  },

  addExtensions() {
    return [
      MarkdownAlignedParagraph,
      MarkdownAlignedHeading.configure({
        headingLevels: this.options.headingLevels,
      }),
    ]
  },
})

export function serializeMarkdownWithTextAlign(
  content: JSONContent,
  extensions: AnyExtension[],
) {
  const manager = new MarkdownManager({
    extensions: [
      MarkdownTextAlign,
      ...extensions,
    ],
    markedOptions: {
      gfm: true,
    },
  })

  return manager.serialize(content)
}

function getTextAlign(node: JSONContent) {
  const textAlign = node.attrs?.textAlign

  if (typeof textAlign !== 'string' || !TEXT_ALIGN_VALUES.has(textAlign)) {
    return null
  }

  return textAlign
}

function inlineContentToHtml(content: JSONContent[]) {
  return content.map((node) => inlineNodeToHtml(node)).join('')
}

function inlineNodeToHtml(node: JSONContent): string {
  if (node.type === 'text') {
    return applyMarks(escapeHtml(node.text ?? ''), node.marks ?? [])
  }

  if (node.type === 'hardBreak') {
    return '<br>'
  }

  if (node.type === 'fileMention') {
    const label = typeof node.attrs?.label === 'string' ? node.attrs.label : ''
    const id = typeof node.attrs?.id === 'string' ? node.attrs.id : ''
    const format = typeof node.attrs?.format === 'string' ? node.attrs.format : ''
    return `@[${escapeHtml(label)}](file:${escapeHtml(id)}?format=${escapeHtml(format)})`
  }

  return inlineContentToHtml(node.content ?? [])
}

function applyMarks(html: string, marks: NonNullable<JSONContent['marks']>) {
  return marks.reduce((value, mark) => {
    switch (mark.type) {
      case 'bold':
        return `<strong>${value}</strong>`
      case 'italic':
        return `<em>${value}</em>`
      case 'strike':
        return `<s>${value}</s>`
      case 'code':
        return `<code>${value}</code>`
      case 'underline':
        return `<u>${value}</u>`
      case 'link':
        return renderLink(value, mark.attrs)
      case 'highlight':
        return `<mark>${value}</mark>`
      case 'patchAddition':
        return `<ins class="patch-diff-addition" data-patch-diff="addition">${value}</ins>`
      case 'patchDeletion':
        return `<del class="patch-diff-deletion" data-patch-diff="deletion">${value}</del>`
      default:
        return value
    }
  }, html)
}

function renderLink(html: string, attrs?: Record<string, unknown>) {
  const href = typeof attrs?.href === 'string' ? attrs.href : ''

  if (!href) {
    return html
  }

  const title = typeof attrs?.title === 'string'
    ? ` title="${escapeAttribute(attrs.title)}"`
    : ''

  return `<a href="${escapeAttribute(href)}"${title}>${html}</a>`
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replaceAll('"', '&quot;')
}
