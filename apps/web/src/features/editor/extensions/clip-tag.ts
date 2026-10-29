import { Node, mergeAttributes, nodeInputRule } from "@tiptap/core"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { badgeVariants } from "@sohizi/ui/badge"
import { cn } from "@/lib/utils"

const UUID_PATTERN =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"

export const CLIP_TAG_INPUT_REGEX = new RegExp(`\\[clip:(${UUID_PATTERN})\\]$`)
export const CLIP_TAG_GLOBAL_REGEX = new RegExp(
  `\\[clip:(${UUID_PATTERN})\\]`,
  "g",
)
const CLIP_TAG_START_REGEX = new RegExp(`^\\[clip:(${UUID_PATTERN})\\]`)

const CLIP_TAG_PLUGIN_KEY = new PluginKey("clipTagAutoFormat")

export interface ClipTagOptions {
  HTMLAttributes: Record<string, unknown>
}

export function getClipBadgeClassName(className?: string) {
  return cn(
    badgeVariants({ variant: "secondary" }),
    "rounded-full align-baseline bg-white/10",
    className,
  )
}

export function replaceClipTagsWithLinks(markdown: string): string {
  return markdown.replace(CLIP_TAG_GLOBAL_REGEX, "[clip](/clip/$1)")
}

export function toClipId(href: string | null | undefined): string | null {
  if (!href) return null
  const trimmed = href.trim()
  let pathname = trimmed
  if (!trimmed.startsWith("/")) {
    try {
      pathname = new URL(trimmed).pathname
    } catch {
      return null
    }
  }
  const match = new RegExp(`^/clip/(${UUID_PATTERN})$`).exec(pathname)
  return match ? match[1] : null
}

export const ClipTag = Node.create<ClipTagOptions>({
  name: "clipTag",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      clipId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-clip-id"),
        renderHTML: (attrs) =>
          attrs.clipId ? { "data-clip-id": String(attrs.clipId) } : {},
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-type="clipTag"][data-clip-id]' }]
  },

  renderText({ node }) {
    return `[clip:${node.attrs.clipId ?? ""}]`
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(
        {
          "data-type": "clipTag",
          "data-slot": "badge",
          class: getClipBadgeClassName(),
        },
        this.options.HTMLAttributes,
        HTMLAttributes,
      ),
      "clip",
    ]
  },

  markdownTokenizer: {
    name: "clipTag",
    level: "inline",
    start: (src: string) => src.search(CLIP_TAG_GLOBAL_REGEX),
    tokenize: (src: string) => {
      const match = CLIP_TAG_START_REGEX.exec(src)
      if (!match) return undefined
      return {
        type: "clipTag",
        raw: match[0],
        clipId: match[1],
      }
    },
  },

  parseMarkdown(token) {
    return {
      type: "clipTag",
      attrs: {
        clipId: token.clipId ?? null,
      },
    }
  },

  renderMarkdown(node) {
    return `[clip:${node.attrs?.clipId ?? ""}]`
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: CLIP_TAG_INPUT_REGEX,
        type: this.type,
        getAttributes: (match) => ({
          clipId: match[1],
        }),
      }),
    ]
  },

  addProseMirrorPlugins() {
    const nodeType = this.type

    return [
      new Plugin({
        key: CLIP_TAG_PLUGIN_KEY,
        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some((tr) => tr.docChanged)) return null

          const replacements: Array<{
            from: number
            to: number
            clipId: string
          }> = []

          newState.doc.descendants((node, pos) => {
            if (!node.isText || !node.text) return
            CLIP_TAG_GLOBAL_REGEX.lastIndex = 0
            let match: RegExpExecArray | null
            while ((match = CLIP_TAG_GLOBAL_REGEX.exec(node.text)) !== null) {
              replacements.push({
                from: pos + match.index,
                to: pos + match.index + match[0].length,
                clipId: match[1],
              })
            }
          })

          if (replacements.length === 0) return null

          const tr = newState.tr
          for (let i = replacements.length - 1; i >= 0; i -= 1) {
            const { from, to, clipId } = replacements[i]
            tr.replaceWith(from, to, nodeType.create({ clipId }))
          }
          return tr
        },
      }),
    ]
  },
})
