import { Node, mergeAttributes } from "@tiptap/core"
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react"
import { Plus, Trash2, X } from "lucide-react"
import {
  PROPERTIES_LAYOUTS,
  findContainerBlockStart,
  matchContainerBlock,
  normalizePropertiesLayout,
  normalizePropertyItems,
  parsePropertiesBlock,
  serializePropertiesBlock,
} from "./markdown-utils"
import type { PropertiesLayout, PropertyItem } from "./markdown-utils"
import type { ReactNodeViewProps } from "@tiptap/react"

declare module "@tiptap/core" {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  interface Commands<ReturnType> {
    propertiesBlock: {
      insertPropertiesBlock: (attrs?: {
        title?: string
        layout?: PropertiesLayout
        items?: Array<PropertyItem>
      }) => ReturnType
    }
  }
}

function parsePropertiesItemsAttr(raw: string | null): Array<PropertyItem> {
  if (!raw) return []
  try {
    return normalizePropertyItems(JSON.parse(raw))
  } catch {
    return []
  }
}

const LAYOUT_LABELS: Record<PropertiesLayout, string> = {
  grid: "Grid",
  list: "List",
  inline: "Inline",
}

export const PropertiesBlock = Node.create({
  name: "propertiesBlock",

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
      layout: {
        default: "grid",
        parseHTML: (el) =>
          normalizePropertiesLayout(el.getAttribute("data-layout")),
        renderHTML: (attrs) => ({
          "data-layout": normalizePropertiesLayout(attrs.layout),
        }),
      },
      items: {
        default: [],
        parseHTML: (el) =>
          parsePropertiesItemsAttr(el.getAttribute("data-items")),
        renderHTML: (attrs) => ({
          "data-items": JSON.stringify(normalizePropertyItems(attrs.items)),
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="properties-block"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "properties-block",
        class: "ui-properties-block",
      }),
    ]
  },

  markdownTokenizer: {
    name: "propertiesBlock",
    level: "block",
    start: (src: string) => findContainerBlockStart(src, "properties"),
    tokenize: (src: string) => {
      const raw = matchContainerBlock(src, "properties")
      if (!raw) return undefined
      return {
        type: "propertiesBlock",
        raw,
        properties: parsePropertiesBlock(raw),
      }
    },
  },

  parseMarkdown: (token) => {
    const parsed = token.properties ?? parsePropertiesBlock(token.raw ?? "")
    return {
      type: "propertiesBlock",
      attrs: {
        title: parsed.title,
        layout: normalizePropertiesLayout(parsed.layout),
        items: normalizePropertyItems(parsed.items),
      },
    }
  },

  renderMarkdown: (node) => {
    return serializePropertiesBlock({
      title: typeof node.attrs?.title === "string" ? node.attrs.title : "",
      layout: normalizePropertiesLayout(node.attrs?.layout),
      items: normalizePropertyItems(node.attrs?.items),
    })
  },

  addCommands() {
    return {
      insertPropertiesBlock:
        (attrs = {}) =>
        ({ commands, state }) => {
          const node = {
            type: this.name,
            attrs: {
              title: attrs.title ?? "Video Specifications",
              layout: normalizePropertiesLayout(attrs.layout),
              items:
                attrs.items && attrs.items.length > 0
                  ? attrs.items
                  : [
                      { key: "Duration", value: "8s" },
                      { key: "Aspect Ratio", value: "16:9" },
                      { key: "Camera", value: "Wide shot" },
                      { key: "Mood", value: "Suspenseful" },
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
    return ReactNodeViewRenderer(PropertiesBlockView)
  },
})

function PropertiesBlockView({
  editor,
  node,
  deleteNode,
  updateAttributes,
}: ReactNodeViewProps) {
  const isEditable = editor.isEditable
  const title = typeof node.attrs.title === "string" ? node.attrs.title : ""
  const layout: PropertiesLayout = normalizePropertiesLayout(node.attrs.layout)
  const items = normalizePropertyItems(node.attrs.items)

  const updateItem = (index: number, patch: Partial<PropertyItem>) => {
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
      items: [...items, { key: "Property", value: "Value" }],
    })
  }

  return (
    <NodeViewWrapper
      className="group/properties relative my-6 rounded-2xl border border-border px-5 py-4"
      contentEditable={false}
    >
      {/* Header row */}
      {(title || isEditable) && (
        <div className="mb-3.5 flex items-center justify-between gap-3">
          {isEditable ? (
            <input
              type="text"
              value={title}
              onChange={(e) => updateAttributes({ title: e.target.value })}
              placeholder="Properties title..."
              className="min-w-0 flex-1 bg-transparent text-base font-semibold tracking-tight text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
            />
          ) : (
            <h4 className="!m-0 text-base font-semibold tracking-tight text-foreground">
              {title}
            </h4>
          )}

          {isEditable && (
            <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover/properties:opacity-100 focus-within:opacity-100">
              <select
                aria-label="Properties layout"
                value={layout}
                onChange={(e) =>
                  updateAttributes({
                    layout: normalizePropertiesLayout(e.target.value),
                  })
                }
                className="cursor-pointer rounded-md bg-transparent px-1.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none"
              >
                {PROPERTIES_LAYOUTS.map((option) => (
                  <option key={option} value={option}>
                    {LAYOUT_LABELS[option]}
                  </option>
                ))}
              </select>
              <span className="mx-0.5 h-3 w-px bg-border" />
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Add property"
              >
                <Plus className="size-3.5" />
                Add
              </button>
              <button
                type="button"
                onClick={deleteNode}
                className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:text-destructive"
                title="Delete properties block"
                aria-label="Delete properties block"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Grid layout */}
      {layout === "grid" && (
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
          {items.map((item, index) => (
            <div
              key={index}
              className="group/prop relative flex items-start justify-between gap-2"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                {isEditable ? (
                  <>
                    <input
                      type="text"
                      value={item.key}
                      onChange={(e) =>
                        updateItem(index, { key: e.target.value })
                      }
                      placeholder="Property..."
                      className="w-full bg-transparent text-xs text-muted-foreground placeholder:text-muted-foreground/50 focus:text-foreground focus:outline-none"
                    />
                    <input
                      type="text"
                      value={item.value}
                      onChange={(e) =>
                        updateItem(index, { value: e.target.value })
                      }
                      placeholder="Value..."
                      className="w-full bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                    />
                  </>
                ) : (
                  <>
                    <span className="text-xs text-muted-foreground">
                      {item.key}
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {item.value}
                    </span>
                  </>
                )}
              </div>

              {isEditable && items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity group-hover/prop:opacity-100 hover:text-destructive"
                  title="Remove property"
                  aria-label="Remove property"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* List layout */}
      {layout === "list" && (
        <div className="flex flex-col gap-2.5">
          {items.map((item, index) => (
            <div
              key={index}
              className="group/prop flex items-baseline justify-between gap-4"
            >
              <div className="flex min-w-0 flex-1 items-baseline gap-4">
                {isEditable ? (
                  <>
                    <input
                      type="text"
                      value={item.key}
                      onChange={(e) =>
                        updateItem(index, { key: e.target.value })
                      }
                      placeholder="Property..."
                      className="w-28 shrink-0 bg-transparent text-xs text-muted-foreground placeholder:text-muted-foreground/50 focus:text-foreground focus:outline-none sm:w-32"
                    />
                    <input
                      type="text"
                      value={item.value}
                      onChange={(e) =>
                        updateItem(index, { value: e.target.value })
                      }
                      placeholder="Value..."
                      className="min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                    />
                  </>
                ) : (
                  <>
                    <span className="w-28 shrink-0 text-xs text-muted-foreground sm:w-32">
                      {item.key}
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-medium text-foreground">
                      {item.value}
                    </span>
                  </>
                )}
              </div>

              {isEditable && items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity group-hover/prop:opacity-100 hover:text-destructive"
                  title="Remove property"
                  aria-label="Remove property"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Inline layout */}
      {layout === "inline" && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {items.map((item, index) => (
            <div
              key={index}
              className="group/prop inline-flex items-baseline gap-1.5"
            >
              {isEditable ? (
                <>
                  <input
                    type="text"
                    value={item.key}
                    onChange={(e) => updateItem(index, { key: e.target.value })}
                    placeholder="Key"
                    style={{
                      width: `${Math.max((item.key || "Key").length, 3)}ch`,
                    }}
                    className="bg-transparent text-xs text-muted-foreground placeholder:text-muted-foreground/50 focus:text-foreground focus:outline-none"
                  />
                  <span className="text-xs text-muted-foreground">:</span>
                  <input
                    type="text"
                    value={item.value}
                    onChange={(e) =>
                      updateItem(index, { value: e.target.value })
                    }
                    placeholder="Value"
                    style={{
                      width: `${Math.max((item.value || "Value").length, 4)}ch`,
                    }}
                    className="bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                  />
                </>
              ) : (
                <>
                  <span className="text-xs text-muted-foreground">
                    {item.key}:
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {item.value}
                  </span>
                </>
              )}

              {isEditable && items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="inline-flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity group-hover/prop:opacity-100 hover:text-destructive"
                  title="Remove property"
                  aria-label="Remove property"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </NodeViewWrapper>
  )
}
