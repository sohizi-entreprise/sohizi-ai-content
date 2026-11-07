import { Node, mergeAttributes } from "@tiptap/core"
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from "@tiptap/react"
import { ImageIcon, Loader2, Trash2, Upload, X } from "lucide-react"
import { useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useFileTreeStore } from "../../stores/file-tree-store"
import { insertNodeAt as insertNodeInCache } from "../../stores/file-tree-cache"
import {
  findContainerBlockStart,
  matchContainerBlock,
  parseCardBlock,
  serializeCardBlock,
} from "./markdown-utils"
import type { MarkdownLexerConfiguration, MarkdownToken } from "@tiptap/core"
import type { CardBlockHeader } from "./markdown-utils"
import type { JSONContent, ReactNodeViewProps } from "@tiptap/react"
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
    cardBlock: {
      insertCardBlock: (attrs?: Partial<CardBlockHeader>) => ReturnType
    }
  }
}

export const CardBlock = Node.create({
  name: "cardBlock",

  group: "block",

  content: "block+",

  isolating: true,

  defining: true,

  addAttributes() {
    return {
      title: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-title") ?? "",
        renderHTML: (attrs) =>
          attrs.title ? { "data-title": String(attrs.title) } : {},
      },
      subtitle: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-subtitle") ?? "",
        renderHTML: (attrs) =>
          attrs.subtitle ? { "data-subtitle": String(attrs.subtitle) } : {},
      },
      badge: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-badge") ?? "",
        renderHTML: (attrs) =>
          attrs.badge ? { "data-badge": String(attrs.badge) } : {},
      },
      image: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-image") ?? "",
        renderHTML: (attrs) =>
          attrs.image ? { "data-image": String(attrs.image) } : {},
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="card-block"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "card-block",
        class: "ui-card-block",
      }),
      0,
    ]
  },

  markdownTokenizer: {
    name: "cardBlock",
    level: "block",
    start: (src: string) => findContainerBlockStart(src, "card"),
    tokenize: (
      src: string,
      _tokens: Array<MarkdownToken>,
      helper: MarkdownLexerConfiguration,
    ) => {
      const raw = matchContainerBlock(src, "card")
      if (!raw) return undefined
      const { header, bodyMarkdown } = parseCardBlock(raw)
      const childTokens = bodyMarkdown ? helper.blockTokens(bodyMarkdown) : []
      return {
        type: "cardBlock",
        raw,
        header,
        tokens: childTokens,
      }
    },
  },

  parseMarkdown: (token, helpers) => {
    const parsedHeader: CardBlockHeader =
      token.header ?? parseCardBlock(token.raw ?? "").header
    const helperWithBlockChildren = helpers as typeof helpers & {
      parseBlockChildren?: (tokens: Array<unknown>) => Array<JSONContent>
    }
    const rawChildren = token.tokens
      ? helperWithBlockChildren.parseBlockChildren
        ? helperWithBlockChildren.parseBlockChildren(token.tokens)
        : helpers.parseChildren(token.tokens)
      : []

    const content =
      Array.isArray(rawChildren) && rawChildren.length > 0
        ? rawChildren
        : [{ type: "paragraph" }]

    return {
      type: "cardBlock",
      attrs: {
        title: parsedHeader.title,
        subtitle: parsedHeader.subtitle,
        badge: parsedHeader.badge,
        image: parsedHeader.image,
      },
      content,
    }
  },

  renderMarkdown: (node, helpers) => {
    const header: CardBlockHeader = {
      title: typeof node.attrs?.title === "string" ? node.attrs.title : "",
      subtitle:
        typeof node.attrs?.subtitle === "string" ? node.attrs.subtitle : "",
      badge: typeof node.attrs?.badge === "string" ? node.attrs.badge : "",
      image: typeof node.attrs?.image === "string" ? node.attrs.image : "",
    }
    const bodyMarkdown = helpers
      .renderChildren(node.content ?? [], "\n\n")
      .trim()
    return serializeCardBlock(header, bodyMarkdown)
  },

  addCommands() {
    return {
      insertCardBlock:
        (attrs = {}) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              title: attrs.title ?? "Untitled",
              subtitle: attrs.subtitle ?? "",
              badge: attrs.badge ?? "",
              image: attrs.image ?? "",
            },
            content: [
              {
                type: "paragraph",
              },
            ],
          })
        },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(CardBlockView)
  },
})

function CardBlockView({
  editor,
  node,
  deleteNode,
  updateAttributes,
}: ReactNodeViewProps) {
  const isEditable = editor.isEditable
  const title = typeof node.attrs.title === "string" ? node.attrs.title : ""
  const subtitle =
    typeof node.attrs.subtitle === "string" ? node.attrs.subtitle : ""
  const badge = typeof node.attrs.badge === "string" ? node.attrs.badge : ""
  const image = typeof node.attrs.image === "string" ? node.attrs.image : ""

  const [showImageInput, setShowImageInput] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const projectId = useFileTreeStore((s) => s.projectId)
  const rootFolderId = useFileTreeStore((s) => s.rootFolderId)
  const queryClient = useQueryClient()

  const handleUploadImage = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.")
      return
    }
    if (!projectId || !rootFolderId) {
      toast.error("Project file tree is not ready yet.")
      return
    }

    setIsUploading(true)
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

      updateAttributes({ image: content.url })
      setShowImageInput(false)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload image.",
      )
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  return (
    <NodeViewWrapper className="group/card relative my-6 border-b border-border py-2">
      {/* Hover action rail */}
      {isEditable && (
        <div
          contentEditable={false}
          className="absolute -top-2 -right-2 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover/card:opacity-100 focus-within:opacity-100"
        >
          {/* <button
            type="button"
            onClick={() => setShowImageInput((prev) => !prev)}
            className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            URL
          </button> */}
          <button
            type="button"
            onClick={deleteNode}
            className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:text-destructive"
            title="Delete card"
            aria-label="Delete card"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      )}

      {isEditable && showImageInput && (
        <div
          contentEditable={false}
          className="mb-4 flex items-center gap-2 rounded-lg border border-border px-3 py-1.5"
        >
          <input
            type="url"
            value={image}
            onChange={(e) => updateAttributes({ image: e.target.value })}
            placeholder="Paste image URL..."
            className="min-w-0 flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {isUploading ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Upload className="size-3" />
            )}
            Upload
          </button>
          {image && (
            <button
              type="button"
              onClick={() => updateAttributes({ image: "" })}
              className="inline-flex size-5 items-center justify-center text-muted-foreground hover:text-destructive"
              title="Remove image"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Horizontal split: Image (or placeholder) always on the left, content on the right */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div
          contentEditable={false}
          className="group/card-img relative aspect-3/4 w-full shrink-0 overflow-hidden rounded-2xl bg-muted/35 sm:w-40"
        >
          {image ? (
            <>
              <img
                src={image}
                alt={title || "Card image"}
                className="m-0! border-0! rounded-none! shadow-none! block h-full w-full object-cover"
              />
              {isEditable && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute right-2 bottom-2 rounded-md bg-black/60 px-2 py-0.5 text-[11px] text-white opacity-0 backdrop-blur-sm transition-opacity group-hover/card-img:opacity-100 hover:bg-black/80"
                >
                  Replace
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              disabled={!isEditable || isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="flex h-full w-full flex-col items-center justify-center gap-1.5 p-3 text-center text-muted-foreground transition-colors hover:text-foreground disabled:cursor-default"
            >
              {isUploading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <ImageIcon className="size-5 opacity-60" />
              )}
              {isEditable && (
                <span className="text-[11px] font-medium">
                  {isUploading ? "Uploading..." : "Add image"}
                </span>
              )}
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void handleUploadImage(e.target.files?.[0])}
          />
        </div>

        <div className="min-w-0 flex-1 py-0.5">
          <div contentEditable={false} className="mb-2.5">
            <div className="flex flex-wrap items-center gap-2 pr-16">
              {isEditable ? (
                <input
                  type="text"
                  value={title}
                  onChange={(e) => updateAttributes({ title: e.target.value })}
                  placeholder="Card title"
                  className="min-w-36 flex-1 bg-transparent text-lg font-semibold tracking-tight text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                />
              ) : (
                title && (
                  <h4 className="m-0! text-lg font-semibold tracking-tight text-foreground">
                    {title}
                  </h4>
                )
              )}

              {(badge || isEditable) &&
                (isEditable ? (
                  <input
                    type="text"
                    value={badge}
                    onChange={(e) =>
                      updateAttributes({ badge: e.target.value })
                    }
                    placeholder="Badge"
                    className={cn(
                      "w-20 rounded-full bg-muted px-2.5 py-0.5 text-center text-xs font-medium text-foreground placeholder:text-muted-foreground/50 focus:outline-none",
                      !badge &&
                        "opacity-0 group-hover/card:opacity-100 focus:opacity-100",
                    )}
                  />
                ) : (
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
                    {badge}
                  </span>
                ))}
            </div>

            {(subtitle || isEditable) && (
              <div
                className={cn(
                  "mt-0.5",
                  !subtitle &&
                    "opacity-0 group-hover/card:opacity-100 focus-within:opacity-100",
                )}
              >
                {isEditable ? (
                  <input
                    type="text"
                    value={subtitle}
                    onChange={(e) =>
                      updateAttributes({ subtitle: e.target.value })
                    }
                    placeholder="Subtitle (e.g. Protagonist · 35 years old)..."
                    className="w-full bg-transparent text-sm text-muted-foreground placeholder:text-muted-foreground/40 focus:text-foreground focus:outline-none"
                  />
                ) : (
                  <p className="m-0! text-sm text-muted-foreground">
                    {subtitle}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="ui-card-block-content text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <NodeViewContent />
          </div>
        </div>
      </div>
    </NodeViewWrapper>
  )
}
