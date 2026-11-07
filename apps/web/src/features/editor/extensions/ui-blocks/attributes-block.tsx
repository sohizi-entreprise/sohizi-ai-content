import { Node, mergeAttributes } from "@tiptap/core"
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react"
import { Plus, Trash2, X } from "lucide-react"
import {
  findContainerBlockStart,
  matchContainerBlock,
  normalizeAttributeItems,
  parseAttributesBlock,
  serializeAttributesBlock,
} from "./markdown-utils"
import type { AttributeItem } from "./markdown-utils"
import type { ReactNodeViewProps } from "@tiptap/react"

declare module "@tiptap/core" {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  interface Commands<ReturnType> {
    attributesBlock: {
      insertAttributesBlock: (attrs?: {
        title?: string
        items?: Array<AttributeItem>
      }) => ReturnType
    }
  }
}

function parseAttributesItemsAttr(raw: string | null): Array<AttributeItem> {
  if (!raw) return []
  try {
    return normalizeAttributeItems(JSON.parse(raw))
  } catch {
    return []
  }
}

export const AttributesBlock = Node.create({
  name: "attributesBlock",

  group: "block",

  atom: true,

  selectable: true,

  draggable: true,

  addAttributes() {
    return {
      title: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-title") ?? "",
        renderHTML: (attrs) =>
          attrs.title ? { "data-title": String(attrs.title) } : {},
      },
      items: {
        default: [],
        parseHTML: (el) =>
          parseAttributesItemsAttr(el.getAttribute("data-items")),
        renderHTML: (attrs) => ({
          "data-items": JSON.stringify(normalizeAttributeItems(attrs.items)),
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="attributes-block"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "attributes-block",
        class: "ui-attributes-block",
      }),
    ]
  },

  markdownTokenizer: {
    name: "attributesBlock",
    level: "block",
    start: (src: string) => findContainerBlockStart(src, "attributes"),
    tokenize: (src: string) => {
      const raw = matchContainerBlock(src, "attributes")
      if (!raw) return undefined
      return {
        type: "attributesBlock",
        raw,
        attributes: parseAttributesBlock(raw),
      }
    },
  },

  parseMarkdown: (token) => {
    const parsed = token.attributes ?? parseAttributesBlock(token.raw ?? "")
    return {
      type: "attributesBlock",
      attrs: {
        title: parsed.title,
        items: normalizeAttributeItems(parsed.items),
      },
    }
  },

  renderMarkdown: (node) => {
    return serializeAttributesBlock({
      title: typeof node.attrs?.title === "string" ? node.attrs.title : "",
      items: normalizeAttributeItems(node.attrs?.items),
    })
  },

  addCommands() {
    return {
      insertAttributesBlock:
        (attrs = {}) =>
        ({ commands, state }) => {
          const node = {
            type: this.name,
            attrs: {
              title: attrs.title ?? "Creative Direction",
              items:
                attrs.items && attrs.items.length > 0
                  ? attrs.items
                  : [
                      {
                        label: "Visual Style",
                        value:
                          "1970s neo-noir cinematography with deep shadows, wet pavement, and subtle analog film grain.",
                      },
                      {
                        label: "Camera Movement",
                        value:
                          "Slow, deliberate tracking shots that gradually reveal the environment.",
                      },
                      {
                        label: "Lighting",
                        value:
                          "Warm sodium-vapor streetlights contrasting with cool blue ambient shadows.",
                      },
                    ],
            },
          }
          if (!state.selection.empty) {
            return commands.insertContentAt(state.selection.to, node)
          }
          return commands.insertContent(node)
        },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(AttributesBlockView)
  },
})

function AttributesBlockView({
  editor,
  node,
  deleteNode,
  updateAttributes,
}: ReactNodeViewProps) {
  const isEditable = editor.isEditable
  const title = typeof node.attrs.title === "string" ? node.attrs.title : ""
  const items = normalizeAttributeItems(node.attrs.items)

  const updateItem = (index: number, patch: Partial<AttributeItem>) => {
    const next = items.map((item, i) =>
      i === index ? { ...item, ...patch } : item,
    )
    updateAttributes({ items: next })
  }

  const removeItem = (index: number) => {
    updateAttributes({
      items: items.filter((_, i) => i !== index),
    })
  }

  const addItem = () => {
    updateAttributes({
      items: [
        ...items,
        {
          label: "New Attribute",
          value: "Detailed explanation...",
        },
      ],
    })
  }

  return (
    <NodeViewWrapper
      className="group/attributes relative my-6 rounded-2xl border border-border px-5 py-4"
      contentEditable={false}
    >
      {/* Header row */}
      {(title || isEditable) && (
        <div className="mb-2 flex items-center justify-between gap-3">
          {isEditable ? (
            <input
              type="text"
              value={title}
              onChange={(e) => updateAttributes({ title: e.target.value })}
              placeholder="Attributes title..."
              className="min-w-0 flex-1 bg-transparent text-base font-semibold tracking-tight text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
            />
          ) : (
            <h4 className="!m-0 text-base font-semibold tracking-tight text-foreground">
              {title}
            </h4>
          )}

          {isEditable && (
            <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover/attributes:opacity-100 focus-within:opacity-100">
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Add attribute"
              >
                <Plus className="size-3.5" />
                Add
              </button>
              <button
                type="button"
                onClick={deleteNode}
                className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:text-destructive"
                title="Delete attributes block"
                aria-label="Delete attributes block"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Divided rows */}
      <div className="divide-y divide-border/70">
        {items.map((item, index) => {
          const displayValue = item.value.replace(/\s*\n\s*/g, " ")
          return (
            <div key={index} className="group/attr py-3.5 first:pt-2 last:pb-1">
              <div className="flex items-center justify-between gap-2">
                {isEditable ? (
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) =>
                      updateItem(index, { label: e.target.value })
                    }
                    placeholder="Attribute label..."
                    className="min-w-0 flex-1 bg-transparent text-xs text-muted-foreground placeholder:text-muted-foreground/50 focus:text-foreground focus:outline-none"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {item.label}
                  </span>
                )}

                {isEditable && items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity group-hover/attr:opacity-100 hover:text-destructive"
                    title="Remove attribute"
                    aria-label="Remove attribute"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {isEditable ? (
                <textarea
                  rows={1}
                  value={displayValue}
                  onChange={(e) => {
                    e.target.style.height = "auto"
                    e.target.style.height = `${e.target.scrollHeight}px`
                    updateItem(index, { value: e.target.value })
                  }}
                  ref={(el) => {
                    if (el) {
                      el.style.height = "auto"
                      el.style.height = `${el.scrollHeight}px`
                    }
                  }}
                  placeholder="Describe this attribute..."
                  className="mt-1 block w-full resize-none overflow-hidden bg-transparent text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                />
              ) : (
                <p className="!m-0 mt-1 text-sm leading-relaxed text-foreground">
                  {displayValue}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </NodeViewWrapper>
  )
}
