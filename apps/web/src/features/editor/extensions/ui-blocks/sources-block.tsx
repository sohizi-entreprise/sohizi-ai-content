import { Node, mergeAttributes } from "@tiptap/core"
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react"
import { ExternalLink, FileText, Library, Plus, Trash2, X } from "lucide-react"
import {
  findContainerBlockStart,
  matchContainerBlock,
  normalizeSourceItems,
  parseSourcesBlockWithMeta,
  serializeSourcesBlock,
} from "./markdown-utils"
import type { SourceItem } from "./markdown-utils"
import type { ReactNodeViewProps } from "@tiptap/react"

declare module "@tiptap/core" {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  interface Commands<ReturnType> {
    sourcesBlock: {
      insertSourcesBlock: (items?: Array<SourceItem>) => ReturnType
    }
  }
}

function parseSourcesAttribute(raw: string | null): Array<SourceItem> {
  if (!raw) return []
  try {
    return normalizeSourceItems(JSON.parse(raw))
  } catch {
    return []
  }
}

export const SourcesBlock = Node.create({
  name: "sourcesBlock",

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
        parseHTML: (element) =>
          parseSourcesAttribute(element.getAttribute("data-items")),
        renderHTML: (attrs) => ({
          "data-items": JSON.stringify(normalizeSourceItems(attrs.items)),
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="sources-block"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "sources-block",
        class: "ui-sources-block",
      }),
    ]
  },

  markdownTokenizer: {
    name: "sourcesBlock",
    level: "block",
    start: (src: string) => findContainerBlockStart(src, "sources"),
    tokenize: (src: string) => {
      const raw = matchContainerBlock(src, "sources")
      if (!raw) return undefined
      const parsed = parseSourcesBlockWithMeta(raw)
      return {
        type: "sourcesBlock",
        raw,
        title: parsed.title,
        items: parsed.items,
      }
    },
  },

  parseMarkdown: (token) => {
    const fallback = parseSourcesBlockWithMeta(token.raw ?? "")
    const title = typeof token.title === "string" ? token.title : fallback.title
    const items = token.items ?? fallback.items
    return {
      type: "sourcesBlock",
      attrs: {
        title,
        items: normalizeSourceItems(items),
      },
    }
  },

  renderMarkdown: (node) => {
    const title = typeof node.attrs?.title === "string" ? node.attrs.title : ""
    const items = normalizeSourceItems(node.attrs?.items)
    return serializeSourcesBlock({ title, items })
  },

  addCommands() {
    return {
      insertSourcesBlock:
        (items) =>
        ({ commands, state }) => {
          const initialItems =
            items && items.length > 0
              ? items
              : [
                  {
                    title: "Reference Source",
                    url: "https://example.com",
                    description: "Key takeaway or reference summary",
                  },
                ]
          const node = {
            type: this.name,
            attrs: { title: "", items: initialItems },
          }
          if (!state.selection.empty) {
            return commands.insertContentAt(state.selection.to, node)
          }
          return commands.insertContent(node)
        },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(SourcesBlockView)
  },
})

function SourcesBlockView({
  editor,
  node,
  deleteNode,
  updateAttributes,
}: ReactNodeViewProps) {
  const isEditable = editor.isEditable
  const title = typeof node.attrs.title === "string" ? node.attrs.title : ""
  const items = normalizeSourceItems(node.attrs.items)

  const updateItem = (index: number, patch: Partial<SourceItem>) => {
    const next = items.map((item, i) =>
      i === index ? { ...item, ...patch } : item,
    )
    updateAttributes({ items: next })
  }

  const removeItem = (index: number) => {
    const next = items.filter((_, i) => i !== index)
    updateAttributes({ items: next })
  }

  const addItem = () => {
    updateAttributes({
      items: [
        ...items,
        {
          title: "New Source",
          url: "https://example.com",
          description: "Source summary",
        },
      ],
    })
  }

  return (
    <NodeViewWrapper
      className="group/sources relative my-6 rounded-2xl border border-border px-5 py-4"
      contentEditable={false}
    >
      {/* Header row */}
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <Library className="size-4 shrink-0 text-muted-foreground" />
          {isEditable ? (
            <input
              type="text"
              value={title}
              onChange={(e) => updateAttributes({ title: e.target.value })}
              placeholder="Sources"
              className="min-w-0 flex-1 bg-transparent text-base font-semibold tracking-tight text-foreground placeholder:text-foreground focus:outline-none"
            />
          ) : (
            <span className="text-base font-semibold tracking-tight text-foreground">
              {title || "Sources"}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {isEditable && (
            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover/sources:opacity-100 focus-within:opacity-100">
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Add source"
              >
                <Plus className="size-3.5" />
                Add
              </button>
              <button
                type="button"
                onClick={deleteNode}
                className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:text-destructive"
                title="Delete sources block"
                aria-label="Delete sources block"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          )}
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {items.length} {items.length === 1 ? "source" : "sources"}
          </span>
        </div>
      </div>

      {/* Divided rows */}
      <div className="divide-y divide-border/70">
        {items.map((item, index) => (
          <div
            key={index}
            className="group/source flex items-center justify-between gap-3 py-3 first:pt-2 last:pb-1"
          >
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <FileText className="mt-1 size-4 shrink-0 text-muted-foreground" />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                {isEditable ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) =>
                        updateItem(index, { title: e.target.value })
                      }
                      placeholder="Source title..."
                      className="min-w-40 flex-1 bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                    />
                    <input
                      type="url"
                      value={item.url}
                      onChange={(e) =>
                        updateItem(index, { url: e.target.value })
                      }
                      placeholder="https://..."
                      className="w-44 bg-transparent text-right text-xs text-muted-foreground opacity-0 transition-opacity group-hover/source:opacity-100 focus:opacity-100 focus:text-foreground focus:outline-none"
                    />
                  </div>
                ) : (
                  <span className="text-sm font-medium text-foreground">
                    {item.title || item.url}
                  </span>
                )}

                {isEditable ? (
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) =>
                      updateItem(index, { description: e.target.value })
                    }
                    placeholder="Summary..."
                    className="w-full bg-transparent text-xs text-muted-foreground placeholder:text-muted-foreground/50 focus:text-foreground focus:outline-none"
                  />
                ) : (
                  item.description && (
                    <p className="!m-0 text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  )
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {isEditable && items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover/source:opacity-100 hover:text-destructive"
                  title="Remove source"
                  aria-label="Remove source"
                >
                  <X className="size-3.5" />
                </button>
              )}
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex size-7 items-center justify-center rounded-md !text-muted-foreground !no-underline transition-colors hover:!text-foreground"
                  title={item.url}
                >
                  <ExternalLink className="size-4 shrink-0 text-muted-foreground transition-colors hover:text-foreground" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </NodeViewWrapper>
  )
}
