import { Node, mergeAttributes } from "@tiptap/core"
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react"
import { Loader2, Plus, Trash2, Upload, X } from "lucide-react"
import { useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useFileTreeStore } from "../../stores/file-tree-store"
import { insertNodeAt as insertNodeInCache } from "../../stores/file-tree-cache"
import {
  MOODBOARD_COLUMN_OPTIONS,
  createDefaultMoodboardItems,
  findContainerBlockStart,
  matchContainerBlock,
  normalizeImageFit,
  normalizeMoodboardColumns,
  normalizeMoodboardItems,
  parseMoodboardBlock,
  serializeMoodboardBlock,
} from "./markdown-utils"
import type {
  ImageFitMode,
  MoodboardColumns,
  MoodboardItem,
} from "./markdown-utils"
import type { ReactNodeViewProps } from "@tiptap/react"
import { cn } from "@/lib/utils"
import api from "@/lib/axios"
import { saveFileToBucket } from "@/hooks/use-save-file-bucket"

type AssetFileContent = {
  type: string
  url: string
  name: string
  storageKey: string
}

declare module "@tiptap/core" {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  interface Commands<ReturnType> {
    moodboardBlock: {
      insertMoodboardBlock: (attrs?: {
        title?: string
        columns?: MoodboardColumns
        fit?: ImageFitMode
        items?: Array<MoodboardItem>
      }) => ReturnType
    }
  }
}

function parseMoodboardItemsAttr(raw: string | null): Array<MoodboardItem> {
  if (!raw) return []
  try {
    return normalizeMoodboardItems(JSON.parse(raw))
  } catch {
    return []
  }
}

export const MoodboardBlock = Node.create({
  name: "moodboardBlock",

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
      columns: {
        default: 2,
        parseHTML: (el) =>
          normalizeMoodboardColumns(el.getAttribute("data-columns")),
        renderHTML: (attrs) => ({
          "data-columns": String(normalizeMoodboardColumns(attrs.columns)),
        }),
      },
      fit: {
        default: "cover",
        parseHTML: (el) => normalizeImageFit(el.getAttribute("data-fit")),
        renderHTML: (attrs) => ({
          "data-fit": normalizeImageFit(attrs.fit),
        }),
      },
      items: {
        default: createDefaultMoodboardItems(),
        parseHTML: (el) =>
          parseMoodboardItemsAttr(el.getAttribute("data-items")),
        renderHTML: (attrs) => ({
          "data-items": JSON.stringify(normalizeMoodboardItems(attrs.items)),
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="moodboard-block"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "moodboard-block",
        class: "ui-moodboard-block",
      }),
    ]
  },

  markdownTokenizer: {
    name: "moodboardBlock",
    level: "block",
    start: (src: string) => findContainerBlockStart(src, "moodboard"),
    tokenize: (src: string) => {
      const raw = matchContainerBlock(src, "moodboard")
      if (!raw) return undefined
      return {
        type: "moodboardBlock",
        raw,
        moodboard: parseMoodboardBlock(raw),
      }
    },
  },

  parseMarkdown: (token) => {
    const parsed = token.moodboard ?? parseMoodboardBlock(token.raw ?? "")
    return {
      type: "moodboardBlock",
      attrs: {
        title: parsed.title,
        columns: normalizeMoodboardColumns(parsed.columns),
        fit: normalizeImageFit(parsed.fit),
        items: normalizeMoodboardItems(parsed.items),
      },
    }
  },

  renderMarkdown: (node) => {
    return serializeMoodboardBlock({
      title: typeof node.attrs?.title === "string" ? node.attrs.title : "",
      columns: normalizeMoodboardColumns(node.attrs?.columns),
      fit: normalizeImageFit(node.attrs?.fit),
      items: normalizeMoodboardItems(node.attrs?.items),
    })
  },

  addCommands() {
    return {
      insertMoodboardBlock:
        (attrs = {}) =>
        ({ commands, state }) => {
          const node = {
            type: this.name,
            attrs: {
              title: attrs.title ?? "",
              columns: normalizeMoodboardColumns(attrs.columns),
              fit: normalizeImageFit(attrs.fit),
              items:
                attrs.items && attrs.items.length > 0
                  ? attrs.items
                  : createDefaultMoodboardItems(),
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
    return ReactNodeViewRenderer(MoodboardBlockView)
  },
})

function MoodboardBlockView({
  editor,
  node,
  deleteNode,
  updateAttributes,
}: ReactNodeViewProps) {
  const isEditable = editor.isEditable
  const title = typeof node.attrs.title === "string" ? node.attrs.title : ""
  const columns: MoodboardColumns = normalizeMoodboardColumns(
    node.attrs.columns,
  )
  const fit: ImageFitMode = normalizeImageFit(node.attrs.fit)
  const parsedItems = normalizeMoodboardItems(node.attrs.items)
  const items =
    parsedItems.length > 0 ? parsedItems : createDefaultMoodboardItems()

  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const activeUploadIndexRef = useRef<number | null>(null)

  const projectId = useFileTreeStore((s) => s.projectId)
  const rootFolderId = useFileTreeStore((s) => s.rootFolderId)
  const queryClient = useQueryClient()

  const updateItem = (index: number, patch: Partial<MoodboardItem>) => {
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
      items: [...items, { url: "", caption: "" }],
    })
  }

  const handleUploadFile = async (file: File | undefined) => {
    const targetIndex = activeUploadIndexRef.current
    if (!file || targetIndex === null) return
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.")
      return
    }
    if (!projectId || !rootFolderId) {
      toast.error("Project file tree is not ready yet.")
      return
    }

    setUploadingIndex(targetIndex)
    try {
      const result = await saveFileToBucket({
        projectId,
        folderId: rootFolderId,
        file,
      })
      if (!result.fileNode) {
        throw new Error("Upload did not create a file.")
      }
      insertNodeInCache(queryClient, projectId, rootFolderId, result.fileNode)

      const { data: content } = await api.get<AssetFileContent>(
        `/projects/${projectId}/files/${result.fileNode.id}`,
      )

      const current = items[targetIndex]
      updateItem(targetIndex, {
        url: content.url,
        caption: current.caption || content.name || file.name,
      })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload image.",
      )
    } finally {
      setUploadingIndex(null)
      activeUploadIndexRef.current = null
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  return (
    <NodeViewWrapper
      className="group/moodboard relative my-6"
      contentEditable={false}
    >
      {/* Subtle header / hover toolbar */}
      {(title || isEditable) && (
        <div
          className={cn(
            "mb-2.5 flex items-center justify-between gap-2 transition-opacity",
            !title &&
              "opacity-0 group-hover/moodboard:opacity-100 focus-within:opacity-100",
          )}
        >
          {isEditable ? (
            <input
              type="text"
              value={title}
              onChange={(e) => updateAttributes({ title: e.target.value })}
              placeholder="Moodboard title (optional)..."
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
            />
          ) : (
            <span className="text-sm font-semibold text-foreground">
              {title}
            </span>
          )}

          {isEditable && (
            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover/moodboard:opacity-100 focus-within:opacity-100">
              <select
                aria-label="Moodboard columns"
                value={columns}
                onChange={(e) =>
                  updateAttributes({
                    columns: normalizeMoodboardColumns(e.target.value),
                  })
                }
                className="cursor-pointer rounded bg-transparent px-1 py-0.5 text-[11px] text-muted-foreground hover:text-foreground focus:outline-none"
              >
                {MOODBOARD_COLUMN_OPTIONS.map((col) => (
                  <option key={col} value={col}>
                    {col} cols
                  </option>
                ))}
              </select>
              <span className="mx-0.5 h-3 w-px bg-border" />
              <select
                aria-label="Moodboard image fit"
                value={fit}
                onChange={(e) =>
                  updateAttributes({ fit: normalizeImageFit(e.target.value) })
                }
                className="cursor-pointer rounded bg-transparent px-1 py-0.5 text-[11px] text-muted-foreground hover:text-foreground focus:outline-none"
              >
                <option value="cover">Cover</option>
                <option value="contain">Contain</option>
              </select>
              <span className="mx-0.5 h-3 w-px bg-border" />
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <Plus className="size-3.5" />
                Add
              </button>
              <button
                type="button"
                onClick={deleteNode}
                className="inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:text-destructive"
                title="Delete moodboard"
                aria-label="Delete moodboard"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Grid layout: 2 columns by default, or 3 columns */}
      <div
        className={cn(
          "grid grid-cols-1 gap-3",
          columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2",
        )}
      >
        {items.map((item, index) => (
          <div
            key={index}
            className="group/mb relative aspect-4/3 w-full overflow-hidden rounded-2xl border border-border/60 bg-muted/20"
          >
            {item.url ? (
              <div className="relative h-full w-full overflow-hidden">
                <img
                  src={item.url}
                  alt={item.caption || `Moodboard item ${index + 1}`}
                  className={cn(
                    "!m-0 !border-0 !rounded-none !shadow-none block h-full w-full",
                    fit === "contain" ? "object-contain" : "object-cover",
                  )}
                />

                {/* Hover overlay for caption and replace/remove actions */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/70 via-black/25 to-transparent p-3 opacity-0 transition-opacity group-hover/mb:opacity-100 focus-within:opacity-100">
                  {isEditable ? (
                    <input
                      type="text"
                      value={item.caption}
                      onChange={(e) =>
                        updateItem(index, { caption: e.target.value })
                      }
                      placeholder="Add caption..."
                      className="pointer-events-auto min-w-0 flex-1 bg-transparent text-xs text-white placeholder:text-white/60 focus:outline-none"
                    />
                  ) : (
                    item.caption && (
                      <span className="text-xs text-white">{item.caption}</span>
                    )
                  )}

                  {isEditable && (
                    <button
                      type="button"
                      onClick={() => {
                        activeUploadIndexRef.current = index
                        fileInputRef.current?.click()
                      }}
                      className="pointer-events-auto shrink-0 rounded-md bg-black/55 px-2 py-0.5 text-[11px] text-white backdrop-blur-sm hover:bg-black/80"
                    >
                      Replace
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-3 text-center">
                <button
                  type="button"
                  disabled={!isEditable || uploadingIndex === index}
                  onClick={() => {
                    activeUploadIndexRef.current = index
                    fileInputRef.current?.click()
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  {uploadingIndex === index ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Upload className="size-3.5" />
                  )}
                  Upload image
                </button>
                {isEditable && (
                  <input
                    type="url"
                    value={item.url}
                    onChange={(e) => updateItem(index, { url: e.target.value })}
                    placeholder="Or paste image URL..."
                    className="w-full bg-transparent text-center text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                  />
                )}
              </div>
            )}

            {isEditable && items.length > 1 && (
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="absolute top-2.5 right-2.5 inline-flex size-6 items-center justify-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover/mb:opacity-100 hover:bg-black/80"
                title="Remove image"
                aria-label="Remove image"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleUploadFile(e.target.files?.[0])}
      />
    </NodeViewWrapper>
  )
}
