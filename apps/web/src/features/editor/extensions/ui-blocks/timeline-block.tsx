import { Node, mergeAttributes } from "@tiptap/core"
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react"
import { Plus, Trash2, X } from "lucide-react"
import { useState } from "react"
import {
  findContainerBlockStart,
  matchContainerBlock,
  normalizeTimelineItems,
  parseDurationToSeconds,
  parseTimelineBlock,
  serializeTimelineBlock,
} from "./markdown-utils"
import type { TimelineBeatItem } from "./markdown-utils"
import type { ReactNodeViewProps } from "@tiptap/react"
import { cn } from "@/lib/utils"

declare module "@tiptap/core" {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  interface Commands<ReturnType> {
    timelineBlock: {
      insertTimelineBlock: (attrs?: {
        title?: string
        items?: Array<TimelineBeatItem>
      }) => ReturnType
    }
  }
}

function parseTimelineItemsAttr(raw: string | null): Array<TimelineBeatItem> {
  if (!raw) return []
  try {
    return normalizeTimelineItems(JSON.parse(raw))
  } catch {
    return []
  }
}

const SEGMENT_COLORS = [
  "#345d7b",
  "#52788f",
  "#9b663d",
  "#764758",
  "#4c6b58",
  "#63557a",
]

function formatSceneBadge(scene: string, fallbackIndex: number): string {
  const trimmed = scene.trim()
  if (!trimmed) return `Scene ${fallbackIndex + 1}`
  const match = trimmed.match(/^scene[-_\s]*0*(\d+)$/i)
  if (match?.[1]) {
    return `Scene ${match[1]}`
  }
  return trimmed
}

function formatTotalSecondsLabel(totalSeconds: number): string {
  if (totalSeconds <= 0) return ""
  const rounded = Math.round(totalSeconds * 10) / 10
  if (rounded < 60) {
    return `${rounded} ${rounded === 1 ? "second" : "seconds"}`
  }
  const mins = Math.floor(rounded / 60)
  const secs = Math.round(rounded % 60)
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
}

export const TimelineBlock = Node.create({
  name: "timelineBlock",

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
          parseTimelineItemsAttr(el.getAttribute("data-items")),
        renderHTML: (attrs) => ({
          "data-items": JSON.stringify(normalizeTimelineItems(attrs.items)),
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="timeline-block"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "timeline-block",
        class: "ui-timeline-block",
      }),
    ]
  },

  markdownTokenizer: {
    name: "timelineBlock",
    level: "block",
    start: (src: string) => findContainerBlockStart(src, "timeline"),
    tokenize: (src: string) => {
      const raw = matchContainerBlock(src, "timeline")
      if (!raw) return undefined
      return {
        type: "timelineBlock",
        raw,
        timeline: parseTimelineBlock(raw),
      }
    },
  },

  parseMarkdown: (token) => {
    const parsed = token.timeline ?? parseTimelineBlock(token.raw ?? "")
    return {
      type: "timelineBlock",
      attrs: {
        title: parsed.title,
        items: normalizeTimelineItems(parsed.items),
      },
    }
  },

  renderMarkdown: (node) => {
    return serializeTimelineBlock({
      title: typeof node.attrs?.title === "string" ? node.attrs.title : "",
      items: normalizeTimelineItems(node.attrs?.items),
    })
  },

  addCommands() {
    return {
      insertTimelineBlock:
        (attrs = {}) =>
        ({ commands, state }) => {
          const node = {
            type: this.name,
            attrs: {
              title: attrs.title ?? "The Last Broadcast",
              items:
                attrs.items && attrs.items.length > 0
                  ? attrs.items
                  : [
                      {
                        duration: "8s",
                        label: "The mysterious signal",
                        scene: "scene-01",
                      },
                      {
                        duration: "12s",
                        label: "Entering the abandoned city",
                        scene: "scene-02",
                      },
                      {
                        duration: "6s",
                        label: "Discovering the truth",
                        scene: "scene-03",
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
    return ReactNodeViewRenderer(TimelineBlockView)
  },
})

function TimelineBlockView({
  editor,
  node,
  deleteNode,
  updateAttributes,
}: ReactNodeViewProps) {
  const isEditable = editor.isEditable
  const title = typeof node.attrs.title === "string" ? node.attrs.title : ""
  const items = normalizeTimelineItems(node.attrs.items)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  const durationsInSeconds = items.map((item) =>
    Math.max(parseDurationToSeconds(item.duration), 1),
  )
  const rawTotalSeconds = items.reduce(
    (sum, item) => sum + parseDurationToSeconds(item.duration),
    0,
  )
  const totalLabel = formatTotalSecondsLabel(rawTotalSeconds)

  // Cumulative end times for each segment
  const cumulativeEnds: Array<number> = []
  let running = 0
  for (const item of items) {
    running += parseDurationToSeconds(item.duration)
    cumulativeEnds.push(Math.round(running * 10) / 10)
  }

  const updateItem = (index: number, patch: Partial<TimelineBeatItem>) => {
    const next = items.map((item, i) =>
      i === index ? { ...item, ...patch } : item,
    )
    updateAttributes({ items: next })
  }

  const removeItem = (index: number) => {
    const next = items.filter((_, i) => i !== index)
    updateAttributes({ items: next })
    if (selectedIndex !== null) {
      if (selectedIndex === index) setSelectedIndex(null)
      else if (selectedIndex > index) setSelectedIndex(selectedIndex - 1)
    }
  }

  const addItem = () => {
    const nextNumber = String(items.length + 1).padStart(2, "0")
    const next = [
      ...items,
      {
        duration: "6s",
        label: "New scene beat",
        scene: `scene-${nextNumber}`,
      },
    ]
    updateAttributes({ items: next })
    setSelectedIndex(next.length - 1)
  }

  const toggleSelect = (index: number) => {
    setSelectedIndex((current) => (current === index ? null : index))
  }

  return (
    <NodeViewWrapper
      className="group/timeline relative my-6 rounded-2xl border border-border p-5"
      contentEditable={false}
    >
      {/* Top header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {isEditable ? (
            <input
              type="text"
              value={title}
              onChange={(e) => updateAttributes({ title: e.target.value })}
              placeholder="Timeline title..."
              className="w-full bg-transparent text-lg font-semibold tracking-tight text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
            />
          ) : (
            <h4 className="!m-0 text-lg font-semibold tracking-tight text-foreground">
              {title || "Timeline"}
            </h4>
          )}
          <p className="!m-0 mt-0.5 text-xs text-muted-foreground">
            {items.length} {items.length === 1 ? "scene" : "scenes"} · Narrative
            timeline
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {isEditable && (
            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover/timeline:opacity-100 focus-within:opacity-100">
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Add scene beat"
              >
                <Plus className="size-3.5" />
                Add
              </button>
              <button
                type="button"
                onClick={deleteNode}
                className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:text-destructive"
                title="Delete timeline"
                aria-label="Delete timeline"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          )}
          {totalLabel && (
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground">
              {totalLabel}
            </span>
          )}
        </div>
      </div>

      {/* Slim proportional colored segment bar without text labels */}
      {items.length > 0 && (
        <div>
          <div className="flex h-3.5 w-full gap-1 overflow-hidden rounded-full">
            {items.map((item, idx) => {
              const weight = durationsInSeconds[idx] ?? 1
              const bgColor = SEGMENT_COLORS[idx % SEGMENT_COLORS.length]
              const isSelected = selectedIndex === idx

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleSelect(idx)}
                  style={{
                    flexGrow: weight,
                    flexBasis: 0,
                    backgroundColor: bgColor,
                  }}
                  title={`${item.label} (${item.duration})`}
                  className={cn(
                    "h-full cursor-pointer transition-all duration-150",
                    idx === 0 && "rounded-l-full",
                    idx === items.length - 1 && "rounded-r-full",
                    selectedIndex !== null && !isSelected && "opacity-45",
                  )}
                />
              )
            })}
          </div>

          {/* Cumulative time markers */}
          <div className="mt-1.5 flex w-full text-[11px] text-muted-foreground">
            {items.map((_, idx) => {
              const weight = durationsInSeconds[idx] ?? 1
              const endSec = cumulativeEnds[idx] ?? 0
              return (
                <div
                  key={idx}
                  style={{ flexGrow: weight, flexBasis: 0 }}
                  className="flex items-center justify-between"
                >
                  <span>{idx === 0 ? "0s" : ""}</span>
                  <span>{endSec}s</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Full scene list with matching color dot and subtle scale highlight when selected */}
      {items.length > 0 && (
        <div className="mt-4 space-y-1">
          {items.map((item, index) => {
            const dotColor = SEGMENT_COLORS[index % SEGMENT_COLORS.length]
            const isSelected = selectedIndex === index

            return (
              <div
                key={index}
                onClick={() => toggleSelect(index)}
                className={cn(
                  "group/beat flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 transition-all duration-200",
                  isSelected
                    ? "scale-[1.015] bg-muted/60 font-medium shadow-2xs"
                    : "hover:bg-muted/30",
                  selectedIndex !== null && !isSelected && "opacity-65",
                )}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    className={cn(
                      "size-2.5 shrink-0 rounded-full transition-transform duration-200",
                      isSelected && "scale-125",
                    )}
                    style={{ backgroundColor: dotColor }}
                  />

                  {isEditable ? (
                    <input
                      type="text"
                      value={item.label}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        updateItem(index, { label: e.target.value })
                      }
                      placeholder="Scene beat description..."
                      className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                    />
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {item.label}
                    </span>
                  )}
                </div>

                <div
                  className="flex shrink-0 items-center gap-2"
                  onClick={(e) => {
                    if (isEditable) e.stopPropagation()
                  }}
                >
                  {isEditable ? (
                    <>
                      <input
                        type="text"
                        value={item.duration}
                        onChange={(e) =>
                          updateItem(index, { duration: e.target.value })
                        }
                        placeholder="8s"
                        className="w-12 bg-transparent text-right font-mono text-xs text-muted-foreground focus:text-foreground focus:outline-none"
                      />
                      <input
                        type="text"
                        value={item.scene}
                        onChange={(e) =>
                          updateItem(index, { scene: e.target.value })
                        }
                        placeholder={`Scene ${index + 1}`}
                        className="w-20 rounded-full bg-muted px-2.5 py-0.5 text-center text-xs text-muted-foreground focus:text-foreground focus:outline-none"
                      />
                    </>
                  ) : (
                    <>
                      <span className="font-mono text-xs text-muted-foreground">
                        {item.duration}
                      </span>
                      {item.scene && (
                        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                          {formatSceneBadge(item.scene, index)}
                        </span>
                      )}
                    </>
                  )}

                  {isEditable && items.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeItem(index)
                      }}
                      className="inline-flex size-5 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity group-hover/beat:opacity-100 hover:text-destructive"
                      title="Remove scene"
                      aria-label="Remove scene"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </NodeViewWrapper>
  )
}
