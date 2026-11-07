import { Node, mergeAttributes } from "@tiptap/core"
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react"
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  X,
} from "lucide-react"
import { useState } from "react"
import {
  findContainerBlockStart,
  matchContainerBlock,
  normalizeTreeItems,
  parseTreeBlock,
  serializeTreeBlock,
} from "./markdown-utils"
import type { TreeItem } from "./markdown-utils"
import type { ReactNodeViewProps } from "@tiptap/react"
import { cn } from "@/lib/utils"

declare module "@tiptap/core" {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  interface Commands<ReturnType> {
    treeBlock: {
      insertTreeBlock: (attrs?: {
        title?: string
        items?: Array<TreeItem>
      }) => ReturnType
    }
  }
}

function parseTreeItemsAttr(raw: string | null): Array<TreeItem> {
  if (!raw) return []
  try {
    return normalizeTreeItems(JSON.parse(raw))
  } catch {
    return []
  }
}

const DEFAULT_TREE_ITEMS: Array<TreeItem> = [
  {
    label: "Video Production",
    description: "30-second cinematic brand film",
    depth: 0,
  },
  {
    label: "Pre-production",
    description: "Creative direction and planning",
    depth: 1,
  },
  {
    label: "Script Development",
    description: "Narrative, dialogue and scene structure",
    depth: 2,
  },
]

export const TreeBlock = Node.create({
  name: "treeBlock",

  group: "block",

  atom: true,

  selectable: false,

  draggable: false,

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
        parseHTML: (el) => parseTreeItemsAttr(el.getAttribute("data-items")),
        renderHTML: (attrs) => ({
          "data-items": JSON.stringify(normalizeTreeItems(attrs.items)),
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="tree-block"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "tree-block",
        class: "ui-tree-block",
      }),
    ]
  },

  markdownTokenizer: {
    name: "treeBlock",
    level: "block",
    start: (src: string) => findContainerBlockStart(src, "tree"),
    tokenize: (src: string) => {
      const raw = matchContainerBlock(src, "tree")
      if (!raw) return undefined
      return {
        type: "treeBlock",
        raw,
        tree: parseTreeBlock(raw),
      }
    },
  },

  parseMarkdown: (token) => {
    const parsed = token.tree ?? parseTreeBlock(token.raw ?? "")
    return {
      type: "treeBlock",
      attrs: {
        title: parsed.title,
        items: normalizeTreeItems(parsed.items),
      },
    }
  },

  renderMarkdown: (node) => {
    return serializeTreeBlock({
      title: typeof node.attrs?.title === "string" ? node.attrs.title : "",
      items: normalizeTreeItems(node.attrs?.items),
    })
  },

  addCommands() {
    return {
      insertTreeBlock:
        (attrs = {}) =>
        ({ commands, state }) => {
          const node = {
            type: this.name,
            attrs: {
              title: attrs.title ?? "",
              items:
                attrs.items && attrs.items.length > 0
                  ? normalizeTreeItems(attrs.items)
                  : DEFAULT_TREE_ITEMS,
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
    return ReactNodeViewRenderer(TreeBlockView)
  },
})

function findSubtreeEndIndex(
  items: ReadonlyArray<TreeItem>,
  parentIndex: number,
): number {
  const parentDepth = items[parentIndex]?.depth ?? 0
  let end = parentIndex
  for (let i = parentIndex + 1; i < items.length; i += 1) {
    if (items[i].depth <= parentDepth) break
    end = i
  }
  return end
}

function TreeBlockView({
  editor,
  node,
  deleteNode,
  updateAttributes,
}: ReactNodeViewProps) {
  const isEditable = editor.isEditable
  const items = normalizeTreeItems(node.attrs.items)
  const [collapsedParents, setCollapsedParents] = useState<Set<number>>(
    () => new Set(),
  )

  const isHiddenByCollapsedAncestor = (index: number): boolean => {
    let targetDepth = items[index]?.depth ?? 0
    for (let i = index - 1; i >= 0; i -= 1) {
      const candidateDepth = items[i].depth
      if (candidateDepth < targetDepth) {
        if (collapsedParents.has(i)) return true
        targetDepth = candidateDepth
        if (targetDepth === 0) break
      }
    }
    return false
  }

  const toggleCollapse = (index: number) => {
    setCollapsedParents((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const updateItem = (index: number, patch: Partial<TreeItem>) => {
    const next = items.map((item, i) =>
      i === index ? { ...item, ...patch } : item,
    )
    updateAttributes({ items: normalizeTreeItems(next) })
  }

  const changeDepth = (index: number, delta: -1 | 1) => {
    if (index < 0 || index >= items.length) return
    const current = items[index]
    const prevDepth = index > 0 ? items[index - 1].depth : -1
    const maxAllowedDepth = prevDepth + 1
    const targetDepth = Math.max(
      0,
      Math.min(maxAllowedDepth, current.depth + delta),
    )
    if (targetDepth === current.depth) return

    const subtreeEnd = findSubtreeEndIndex(items, index)
    const actualDelta = targetDepth - current.depth
    const next = items.map((item, i) => {
      if (i >= index && i <= subtreeEnd) {
        return { ...item, depth: Math.max(0, item.depth + actualDelta) }
      }
      return item
    })
    updateAttributes({ items: normalizeTreeItems(next) })
  }

  const addChildOrSiblingItem = (index: number) => {
    if (index < 0 || index >= items.length) return
    const current = items[index]
    const insertAfter = findSubtreeEndIndex(items, index)
    const newItem: TreeItem = {
      label: "New item",
      description: "Description",
      depth: current.depth + 1,
    }
    const next = [
      ...items.slice(0, insertAfter + 1),
      newItem,
      ...items.slice(insertAfter + 1),
    ]
    setCollapsedParents((prev) => {
      if (!prev.has(index)) return prev
      const updated = new Set(prev)
      updated.delete(index)
      return updated
    })
    updateAttributes({ items: normalizeTreeItems(next) })
  }

  const removeItem = (index: number) => {
    if (index === 0) {
      deleteNode()
      return
    }
    const next = items.filter((_, i) => i !== index)
    if (next.length === 0) {
      deleteNode()
      return
    }
    updateAttributes({ items: normalizeTreeItems(next) })
  }

  return (
    <NodeViewWrapper
      className="group/tree relative my-6 py-1"
      contentEditable={false}
    >
      {/* Hierarchy list */}
      <div className="flex flex-col gap-1.5">
        {items.map((item, index) => {
          if (isHiddenByCollapsedAncestor(index)) return null

          const hasChildren =
            index + 1 < items.length && items[index + 1].depth > item.depth
          const isCollapsed = collapsedParents.has(index)
          const prevDepth = index > 0 ? items[index - 1].depth : -1
          const canIndent = index > 0 && item.depth <= prevDepth
          const canOutdent = item.depth > 0
          const indentOffsetPx = item.depth > 0 ? 10 + (item.depth - 1) * 22 : 0

          return (
            <div
              key={index}
              style={
                indentOffsetPx > 0
                  ? { marginLeft: `${indentOffsetPx}px` }
                  : undefined
              }
              className={cn(
                "group/node relative flex items-start justify-between gap-3 py-1.5",
                item.depth > 0 && "border-l border-border/80 pl-5",
              )}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex min-w-0 items-center gap-1.5">
                  {isEditable ? (
                    <input
                      type="text"
                      value={item.label}
                      onChange={(e) =>
                        updateItem(index, { label: e.target.value })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Tab") {
                          e.preventDefault()
                          changeDepth(index, e.shiftKey ? -1 : 1)
                        }
                      }}
                      placeholder="Item title..."
                      style={{
                        width: `${Math.max((item.label || "Item title").length + 1, 10)}ch`,
                      }}
                      className="max-w-full bg-transparent text-[0.95rem] leading-snug text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                    />
                  ) : (
                    <span
                      onClick={
                        hasChildren ? () => toggleCollapse(index) : undefined
                      }
                      className={cn(
                        "text-[0.95rem] leading-snug text-foreground",
                        hasChildren && "cursor-pointer",
                      )}
                    >
                      {item.label}
                    </span>
                  )}

                  {hasChildren && (
                    <button
                      type="button"
                      onClick={() => toggleCollapse(index)}
                      className={cn(
                        "inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-opacity hover:bg-muted hover:text-foreground",
                        !isCollapsed &&
                          "opacity-0 group-hover/node:opacity-100 focus-visible:opacity-100",
                      )}
                      title={
                        isCollapsed ? "Expand children" : "Collapse children"
                      }
                      aria-label={
                        isCollapsed ? "Expand children" : "Collapse children"
                      }
                    >
                      {isCollapsed ? (
                        <ChevronRight className="size-3.5" />
                      ) : (
                        <ChevronDown className="size-3.5" />
                      )}
                    </button>
                  )}
                </div>

                {isEditable ? (
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) =>
                      updateItem(index, { description: e.target.value })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Tab") {
                        e.preventDefault()
                        changeDepth(index, e.shiftKey ? -1 : 1)
                      }
                    }}
                    placeholder="Description..."
                    style={{ color: "var(--muted-foreground)" }}
                    className="w-full bg-transparent text-[0.85em] leading-snug text-muted-foreground focus:text-muted-foreground placeholder:text-muted-foreground/40 focus:outline-none"
                  />
                ) : (
                  item.description && (
                    <span
                      style={{ color: "var(--muted-foreground)" }}
                      className="text-[0.85em] leading-snug text-muted-foreground"
                    >
                      {item.description}
                    </span>
                  )
                )}
              </div>

              {/* Hover item actions in editable mode */}
              {isEditable && (
                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/node:opacity-100 focus-within:opacity-100">
                  {index > 0 && (
                    <>
                      <button
                        type="button"
                        disabled={!canOutdent}
                        onClick={() => changeDepth(index, -1)}
                        className="inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                        title="Outdent (Shift+Tab)"
                        aria-label="Outdent item"
                      >
                        <ChevronLeft className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={!canIndent}
                        onClick={() => changeDepth(index, 1)}
                        className="inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                        title="Indent (Tab)"
                        aria-label="Indent item"
                      >
                        <ChevronRight className="size-3.5" />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => addChildOrSiblingItem(index)}
                    className="inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="Add child item"
                    aria-label="Add child item"
                  >
                    <Plus className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:text-destructive"
                    title={index === 0 ? "Delete tree block" : "Remove item"}
                    aria-label={
                      index === 0 ? "Delete tree block" : "Remove item"
                    }
                  >
                    {index === 0 ? (
                      <Trash2 className="size-3.5" />
                    ) : (
                      <X className="size-3.5" />
                    )}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </NodeViewWrapper>
  )
}
