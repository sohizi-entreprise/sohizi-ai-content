import { Node, mergeAttributes } from "@tiptap/core"
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react"
import { Check, Copy, Plus, Trash2, X } from "lucide-react"
import { useState } from "react"
import {
  findContainerBlockStart,
  matchContainerBlock,
  normalizePaletteSwatches,
  parsePaletteBlock,
  serializePaletteBlock,
} from "./markdown-utils"
import type { PaletteSwatch } from "./markdown-utils"
import type { ReactNodeViewProps } from "@tiptap/react"
import { cn } from "@/lib/utils"

declare module "@tiptap/core" {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  interface Commands<ReturnType> {
    paletteBlock: {
      insertPaletteBlock: (swatches?: Array<PaletteSwatch>) => ReturnType
    }
  }
}

function parseSwatchesAttribute(raw: string | null): Array<PaletteSwatch> {
  if (!raw) return []
  try {
    return normalizePaletteSwatches(JSON.parse(raw))
  } catch {
    return []
  }
}

export const PaletteBlock = Node.create({
  name: "paletteBlock",

  group: "block",

  atom: true,

  selectable: true,

  draggable: true,

  addAttributes() {
    return {
      swatches: {
        default: [],
        parseHTML: (element) =>
          parseSwatchesAttribute(element.getAttribute("data-swatches")),
        renderHTML: (attrs) => ({
          "data-swatches": JSON.stringify(
            normalizePaletteSwatches(attrs.swatches),
          ),
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="palette-block"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "palette-block",
        class: "ui-palette-block",
      }),
    ]
  },

  markdownTokenizer: {
    name: "paletteBlock",
    level: "block",
    start: (src: string) => findContainerBlockStart(src, "palette"),
    tokenize: (src: string) => {
      const raw = matchContainerBlock(src, "palette")
      if (!raw) return undefined
      return {
        type: "paletteBlock",
        raw,
        swatches: parsePaletteBlock(raw),
      }
    },
  },

  parseMarkdown: (token) => {
    const swatches = token.swatches ?? parsePaletteBlock(token.raw ?? "")
    return {
      type: "paletteBlock",
      attrs: {
        swatches: normalizePaletteSwatches(swatches),
      },
    }
  },

  renderMarkdown: (node) => {
    return serializePaletteBlock(normalizePaletteSwatches(node.attrs?.swatches))
  },

  addCommands() {
    return {
      insertPaletteBlock:
        (swatches) =>
        ({ commands, state }) => {
          const initialSwatches =
            swatches && swatches.length > 0
              ? swatches
              : [
                  { color: "#1a1a1a", label: "Background Noir" },
                  { color: "#c4a574", label: "Warm Key Light" },
                  { color: "#e63946", label: "Danger Accent" },
                  { color: "#415a77", label: "Shadow Blue" },
                ]
          const node = {
            type: this.name,
            attrs: { swatches: initialSwatches },
          }
          if (!state.selection.empty) {
            return commands.insertContentAt(state.selection.to, node)
          }
          return commands.insertContent(node)
        },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(PaletteBlockView)
  },
})

function PaletteBlockView({
  editor,
  node,
  deleteNode,
  updateAttributes,
}: ReactNodeViewProps) {
  const isEditable = editor.isEditable
  const swatches = normalizePaletteSwatches(node.attrs.swatches)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  const updateSwatch = (index: number, patch: Partial<PaletteSwatch>) => {
    const next = swatches.map((swatch, i) =>
      i === index ? { ...swatch, ...patch } : swatch,
    )
    updateAttributes({ swatches: next })
  }

  const removeSwatch = (index: number) => {
    updateAttributes({
      swatches: swatches.filter((_, i) => i !== index),
    })
  }

  const addSwatch = () => {
    updateAttributes({
      swatches: [...swatches, { color: "#415a77", label: "New Swatch" }],
    })
  }

  const copyColor = (color: string, index: number) => {
    void navigator.clipboard.writeText(color)
    setCopiedIndex(index)
    setTimeout(() => {
      setCopiedIndex((current) => (current === index ? null : current))
    }, 1400)
  }

  return (
    <NodeViewWrapper
      className="group/palette relative my-6 rounded-2xl border border-border p-4"
      contentEditable={false}
    >
      {/* Hover controls */}
      {isEditable && (
        <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 rounded-lg border border-border bg-background/85 px-1.5 py-0.5 opacity-0 backdrop-blur-sm transition-opacity group-hover/palette:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            onClick={addSwatch}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
            title="Add color"
          >
            <Plus className="size-3.5" />
            Add
          </button>
          <button
            type="button"
            onClick={deleteNode}
            className="inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:text-destructive"
            title="Delete palette"
            aria-label="Delete palette"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      )}

      {/* Top continuous color strip */}
      {swatches.length > 0 && (
        <div className="flex h-10 w-full gap-0.5 overflow-hidden rounded-lg">
          {swatches.map((swatch, index) => {
            const validHex = /^#[0-9a-fA-F]{6}$/.test(swatch.color)
              ? swatch.color
              : "#000000"
            return (
              <label
                key={index}
                style={{ backgroundColor: swatch.color }}
                className={cn(
                  "relative h-full flex-1 cursor-pointer transition-opacity hover:opacity-95",
                  index === 0 && "rounded-l-lg",
                  index === swatches.length - 1 && "rounded-r-lg",
                )}
                title={
                  isEditable
                    ? `Click to change ${swatch.label || swatch.color}`
                    : `${swatch.label || swatch.color}`
                }
              >
                {isEditable && (
                  <input
                    type="color"
                    value={validHex}
                    onChange={(e) =>
                      updateSwatch(index, { color: e.target.value })
                    }
                    className="sr-only"
                  />
                )}
              </label>
            )
          })}
        </div>
      )}

      {/* Bottom 2-column swatch legend */}
      <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
        {swatches.map((swatch, index) => {
          const validHex = /^#[0-9a-fA-F]{6}$/.test(swatch.color)
            ? swatch.color
            : "#000000"
          return (
            <div
              key={index}
              className="group/swatch flex items-center justify-between gap-3"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <label
                  className="relative size-7 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-border/50"
                  style={{ backgroundColor: swatch.color }}
                >
                  {isEditable && (
                    <input
                      type="color"
                      value={validHex}
                      onChange={(e) =>
                        updateSwatch(index, { color: e.target.value })
                      }
                      className="sr-only"
                    />
                  )}
                </label>

                <div className="flex min-w-0 flex-1 flex-col">
                  {isEditable ? (
                    <input
                      type="text"
                      value={swatch.label}
                      onChange={(e) =>
                        updateSwatch(index, { label: e.target.value })
                      }
                      placeholder="Color role..."
                      className="w-full bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                    />
                  ) : (
                    <span className="truncate text-sm font-medium text-foreground">
                      {swatch.label || swatch.color}
                    </span>
                  )}

                  {isEditable ? (
                    <input
                      type="text"
                      value={swatch.color}
                      onChange={(e) =>
                        updateSwatch(index, { color: e.target.value })
                      }
                      className="w-full bg-transparent font-mono text-xs text-muted-foreground focus:text-foreground focus:outline-none"
                    />
                  ) : (
                    <span className="font-mono text-xs text-muted-foreground">
                      {swatch.color}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {isEditable && swatches.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSwatch(index)}
                    className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover/swatch:opacity-100 hover:text-destructive"
                    title="Remove color"
                    aria-label="Remove color"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => copyColor(swatch.color, index)}
                  className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
                  title="Copy color hex"
                >
                  {copiedIndex === index ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </NodeViewWrapper>
  )
}
