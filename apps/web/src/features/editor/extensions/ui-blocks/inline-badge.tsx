import { Node, mergeAttributes, nodeInputRule } from "@tiptap/core"
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { useEffect, useRef, useState } from "react"
import {
  INLINE_BADGE_COLORS,
  normalizeBadgeColor,
  serializeInlineBadge,
} from "./markdown-utils"
import type { InlineBadgeColor } from "./markdown-utils"
import type { ReactNodeViewProps } from "@tiptap/react"
import { cn } from "@/lib/utils"

const BADGE_PATTERN =
  ":badge\\[([^\\]\\r\\n]+)\\](?:\\{color=(highlight|warning|danger|neutral)\\})?"

export const INLINE_BADGE_INPUT_REGEX = new RegExp(`${BADGE_PATTERN}$`)
export const INLINE_BADGE_GLOBAL_REGEX = new RegExp(BADGE_PATTERN, "g")
const INLINE_BADGE_START_REGEX = new RegExp(`^${BADGE_PATTERN}`)

const INLINE_BADGE_PLUGIN_KEY = new PluginKey("inlineBadgeAutoFormat")

declare module "@tiptap/core" {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  interface Commands<ReturnType> {
    inlineBadge: {
      insertInlineBadge: (attrs?: {
        label?: string
        color?: InlineBadgeColor
      }) => ReturnType
    }
  }
}

const BADGE_COLOR_CLASSES: Record<InlineBadgeColor, string> = {
  highlight: "border-primary/25 bg-primary/10 text-primary",
  warning:
    "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  danger: "border-destructive/25 bg-destructive/10 text-destructive",
  neutral: "border-transparent bg-muted text-foreground/90",
}

const BADGE_DOT_CLASSES: Record<InlineBadgeColor, string> = {
  highlight: "bg-primary",
  warning: "bg-amber-500",
  danger: "bg-destructive",
  neutral: "bg-muted-foreground",
}

export function getInlineBadgeClassName(color: InlineBadgeColor) {
  return cn(
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium leading-none align-baseline select-none transition-colors",
    BADGE_COLOR_CLASSES[color],
  )
}

export const InlineBadge = Node.create({
  name: "inlineBadge",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      label: {
        default: "Badge",
        parseHTML: (el) =>
          el.getAttribute("data-label") ?? (el.textContent || "Badge"),
        renderHTML: (attrs) => ({
          "data-label": String(attrs.label ?? "Badge"),
        }),
      },
      color: {
        default: "neutral",
        parseHTML: (el) => normalizeBadgeColor(el.getAttribute("data-color")),
        renderHTML: (attrs) => ({
          "data-color": normalizeBadgeColor(attrs.color),
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-type="inline-badge"]' }]
  },

  renderText({ node }) {
    return serializeInlineBadge(
      String(node.attrs.label ?? "Badge"),
      normalizeBadgeColor(node.attrs.color),
    )
  },

  renderHTML({ node, HTMLAttributes }) {
    const color = normalizeBadgeColor(node.attrs.color)
    const label = String(node.attrs.label ?? "Badge")
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-type": "inline-badge",
        class: getInlineBadgeClassName(color),
      }),
      label,
    ]
  },

  markdownTokenizer: {
    name: "inlineBadge",
    level: "inline",
    start: (src: string) => src.search(INLINE_BADGE_GLOBAL_REGEX),
    tokenize: (src: string) => {
      const match = INLINE_BADGE_START_REGEX.exec(src)
      if (!match) return undefined
      return {
        type: "inlineBadge",
        raw: match[0],
        label: match[1].trim(),
        color: normalizeBadgeColor(match[2]),
      }
    },
  },

  parseMarkdown(token) {
    return {
      type: "inlineBadge",
      attrs: {
        label: typeof token.label === "string" ? token.label : "Badge",
        color: normalizeBadgeColor(token.color),
      },
    }
  },

  renderMarkdown(node) {
    return serializeInlineBadge(
      String(node.attrs?.label ?? "Badge"),
      normalizeBadgeColor(node.attrs?.color),
    )
  },

  addCommands() {
    return {
      insertInlineBadge:
        (attrs = {}) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              label: attrs.label ?? "Approved",
              color: normalizeBadgeColor(attrs.color ?? "highlight"),
            },
          })
        },
    }
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: INLINE_BADGE_INPUT_REGEX,
        type: this.type,
        getAttributes: (match) => ({
          label: match[1].trim() || "Badge",
          color: normalizeBadgeColor(match[2]),
        }),
      }),
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(InlineBadgeView)
  },

  addProseMirrorPlugins() {
    const nodeType = this.type

    return [
      new Plugin({
        key: INLINE_BADGE_PLUGIN_KEY,
        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some((tr) => tr.docChanged)) return null

          const replacements: Array<{
            from: number
            to: number
            label: string
            color: InlineBadgeColor
          }> = []

          newState.doc.descendants((node, pos) => {
            if (!node.isText || !node.text) return
            INLINE_BADGE_GLOBAL_REGEX.lastIndex = 0
            let match: RegExpExecArray | null
            while (
              (match = INLINE_BADGE_GLOBAL_REGEX.exec(node.text)) !== null
            ) {
              replacements.push({
                from: pos + match.index,
                to: pos + match.index + match[0].length,
                label: match[1].trim(),
                color: normalizeBadgeColor(match[2]),
              })
            }
          })

          if (replacements.length === 0) return null

          const tr = newState.tr
          for (let i = replacements.length - 1; i >= 0; i -= 1) {
            const { from, to, label, color } = replacements[i]
            tr.replaceWith(from, to, nodeType.create({ label, color }))
          }
          return tr
        },
      }),
    ]
  },
})

function InlineBadgeView({
  editor,
  node,
  updateAttributes,
}: ReactNodeViewProps) {
  const isEditable = editor.isEditable
  const label = String(node.attrs.label ?? "Badge")
  const color = normalizeBadgeColor(node.attrs.color)

  const [isEditingText, setIsEditingText] = useState(false)
  const [draftLabel, setDraftLabel] = useState(label)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setDraftLabel(label)
  }, [label])

  useEffect(() => {
    if (isEditingText && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditingText])

  const commitLabel = () => {
    const cleaned = draftLabel.trim() || "Badge"
    setDraftLabel(cleaned)
    updateAttributes({ label: cleaned })
    setIsEditingText(false)
  }

  const cycleColor = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (!isEditable) return
    const currentIdx = INLINE_BADGE_COLORS.indexOf(color)
    const nextColor =
      INLINE_BADGE_COLORS[(currentIdx + 1) % INLINE_BADGE_COLORS.length]
    updateAttributes({ color: nextColor })
  }

  return (
    <NodeViewWrapper
      as="span"
      contentEditable={false}
      data-type="inline-badge"
      data-label={label}
      data-color={color}
      onClick={(event: React.MouseEvent) => {
        if (!isEditable) return
        event.stopPropagation()
        if (!isEditingText) {
          setIsEditingText(true)
        }
      }}
      className={cn(
        "group/badge relative inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium leading-none align-baseline transition-colors",
        isEditable && "cursor-text",
        BADGE_COLOR_CLASSES[color],
      )}
    >
      {isEditable && (
        <button
          type="button"
          onClick={cycleColor}
          onMouseDown={(e) => e.preventDefault()}
          title="Change badge color"
          aria-label="Change badge color"
          className={cn(
            " pointer-events-none absolute -top-1.5 -right-1.5 z-10 size-3 cursor-pointer rounded-full opacity-0 transition-opacity duration-150 after:absolute after:-inset-1 group-hover/badge:pointer-events-auto group-hover/badge:opacity-100",
            isEditingText && "pointer-events-auto opacity-100",
            BADGE_DOT_CLASSES[color],
          )}
        />
      )}

      {isEditingText && isEditable ? (
        <input
          ref={inputRef}
          type="text"
          value={draftLabel}
          style={{ width: `${Math.max(draftLabel.length, 3)}ch` }}
          onChange={(e) => setDraftLabel(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === "Enter") {
              e.preventDefault()
              commitLabel()
            } else if (e.key === "Escape") {
              e.preventDefault()
              setDraftLabel(label)
              setIsEditingText(false)
            }
          }}
          className="min-w-[2ch] bg-transparent p-0 text-xs font-medium text-current focus:outline-none"
        />
      ) : (
        <span>{label}</span>
      )}
    </NodeViewWrapper>
  )
}
