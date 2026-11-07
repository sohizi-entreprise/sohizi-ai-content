import { Node, mergeAttributes } from "@tiptap/core"
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react"
import { Loader2, Trash2, Upload } from "lucide-react"
import { useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useFileTreeStore } from "../../stores/file-tree-store"
import { insertNodeAt as insertNodeInCache } from "../../stores/file-tree-cache"
import {
  MEDIA_BLOCK_TYPES,
  findContainerBlockStart,
  matchContainerBlock,
  normalizeImageFit,
  normalizeMediaType,
  parseMediaBlock,
  serializeMediaBlock,
} from "./markdown-utils"
import type {
  ImageFitMode,
  MediaBlockData,
  MediaBlockType,
} from "./markdown-utils"
import type { ReactNodeViewProps } from "@tiptap/react"
import type { DragEvent } from "react"
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
    mediaBlock: {
      insertMediaBlock: (attrs?: Partial<MediaBlockData>) => ReturnType
    }
  }
}

export function getYoutubeEmbedUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim()
  if (!trimmed) return null

  try {
    const parsed = new URL(trimmed)
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase()

    if (host === "youtu.be") {
      const id = parsed.pathname.slice(1).split("/")[0]
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null
    }

    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "youtube-nocookie.com"
    ) {
      if (parsed.pathname === "/watch") {
        const id = parsed.searchParams.get("v")
        return id ? `https://www.youtube-nocookie.com/embed/${id}` : null
      }
      const embedMatch = parsed.pathname.match(
        /^\/(?:embed|shorts|live)\/([^/?#]+)/,
      )
      if (embedMatch?.[1]) {
        return `https://www.youtube-nocookie.com/embed/${embedMatch[1]}`
      }
    }
  } catch {
    return null
  }

  return null
}

function parseLegacyImageLayoutElement(element: HTMLElement): MediaBlockData {
  const imagesJson = element.getAttribute("data-images")
  if (imagesJson) {
    try {
      const parsed = JSON.parse(imagesJson) as unknown
      if (Array.isArray(parsed) && parsed.length > 0) {
        const first: unknown = parsed[0]
        if (typeof first === "string") {
          return { type: "image", url: first, alt: "", fit: "cover" }
        }
        if (first && typeof first === "object") {
          const record = first as Record<string, unknown>
          return {
            type: "image",
            url: typeof record.url === "string" ? record.url : "",
            alt: typeof record.name === "string" ? record.name : "",
            fit: "cover",
          }
        }
      }
    } catch {
      // ignore invalid JSON
    }
  }

  const img = element.querySelector("img")
  return {
    type: "image",
    url: img?.getAttribute("src") ?? "",
    alt: img?.getAttribute("alt") ?? "",
    fit: "cover",
  }
}

export const MediaBlock = Node.create({
  name: "mediaBlock",

  group: "block",

  atom: true,

  selectable: true,

  draggable: true,

  addAttributes() {
    return {
      type: {
        default: "image",
        parseHTML: (element) =>
          normalizeMediaType(element.getAttribute("data-media-type")),
        renderHTML: (attrs) => ({
          "data-media-type": normalizeMediaType(attrs.type),
        }),
      },
      url: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-url") ?? "",
        renderHTML: (attrs) => ({
          "data-url": typeof attrs.url === "string" ? attrs.url : "",
        }),
      },
      alt: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-alt") ?? "",
        renderHTML: (attrs) => ({
          "data-alt": typeof attrs.alt === "string" ? attrs.alt : "",
        }),
      },
      fit: {
        default: "cover",
        parseHTML: (element) =>
          normalizeImageFit(element.getAttribute("data-fit")),
        renderHTML: (attrs) => ({
          "data-fit": normalizeImageFit(attrs.fit),
        }),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="media-block"]',
      },
      {
        tag: 'div[data-type="image-layout"]',
        getAttrs: (node) => {
          return parseLegacyImageLayoutElement(node)
        },
      },
      {
        tag: "div[data-youtube-video]",
        getAttrs: (node) => {
          const iframe = node.querySelector("iframe")
          return {
            type: "video",
            url: iframe?.getAttribute("src") ?? "",
            alt: iframe?.getAttribute("title") ?? "",
            fit: "cover",
          }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "media-block",
        class: "ui-media-block",
      }),
    ]
  },

  markdownTokenizer: {
    name: "mediaBlock",
    level: "block",
    start: (src: string) => findContainerBlockStart(src, "media"),
    tokenize: (src: string) => {
      const raw = matchContainerBlock(src, "media")
      if (!raw) return undefined
      return {
        type: "mediaBlock",
        raw,
        media: parseMediaBlock(raw),
      }
    },
  },

  parseMarkdown: (token) => {
    const media: MediaBlockData =
      token.media ?? parseMediaBlock(token.raw ?? "")
    return {
      type: "mediaBlock",
      attrs: {
        type: media.type,
        url: media.url,
        alt: media.alt,
        fit: normalizeImageFit(media.fit),
      },
    }
  },

  renderMarkdown: (node) => {
    return serializeMediaBlock({
      type: normalizeMediaType(node.attrs?.type),
      url: typeof node.attrs?.url === "string" ? node.attrs.url : "",
      alt: typeof node.attrs?.alt === "string" ? node.attrs.alt : "",
      fit: normalizeImageFit(node.attrs?.fit),
    })
  },

  addCommands() {
    return {
      insertMediaBlock:
        (attrs = {}) =>
        ({ commands, state }) => {
          const node = {
            type: this.name,
            attrs: {
              type: normalizeMediaType(attrs.type),
              url: attrs.url ?? "",
              alt: attrs.alt ?? "",
              fit: normalizeImageFit(attrs.fit),
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
    return ReactNodeViewRenderer(MediaBlockView)
  },
})

const MEDIA_ACCEPT: Record<MediaBlockType, string> = {
  image: "image/*",
  video: "video/*",
  audio: "audio/*",
}

function MediaBlockView({
  editor,
  node,
  deleteNode,
  updateAttributes,
}: ReactNodeViewProps) {
  const isEditable = editor.isEditable
  const mediaType = normalizeMediaType(node.attrs.type)
  const url = typeof node.attrs.url === "string" ? node.attrs.url : ""
  const alt = typeof node.attrs.alt === "string" ? node.attrs.alt : ""
  const fit: ImageFitMode = normalizeImageFit(node.attrs.fit)

  const [urlInput, setUrlInput] = useState(url)
  const [isEditingUrl, setIsEditingUrl] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const projectId = useFileTreeStore((s) => s.projectId)
  const rootFolderId = useFileTreeStore((s) => s.rootFolderId)
  const queryClient = useQueryClient()

  const commitUrl = (nextUrl: string) => {
    const trimmed = nextUrl.trim()
    const inferredType =
      getYoutubeEmbedUrl(trimmed) !== null ? ("video" as const) : mediaType
    updateAttributes({ url: trimmed, type: inferredType })
    setUrlInput(trimmed)
    setIsEditingUrl(false)
  }

  const uploadMediaFile = async (file: File | undefined) => {
    if (!file) return
    if (!projectId || !rootFolderId) {
      toast.error("Project file tree is not ready yet.")
      return
    }

    let nextType: MediaBlockType = mediaType
    if (file.type.startsWith("image/")) nextType = "image"
    else if (file.type.startsWith("video/")) nextType = "video"
    else if (file.type.startsWith("audio/")) nextType = "audio"

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

      updateAttributes({
        type: nextType,
        url: content.url,
        alt: alt || content.name || file.name,
      })
      setUrlInput(content.url)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload media.",
      )
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!isEditable) return
    event.preventDefault()
    setIsDragging(false)
    void uploadMediaFile(event.dataTransfer.files[0])
  }

  const youtubeEmbedUrl = mediaType === "video" ? getYoutubeEmbedUrl(url) : null

  return (
    <NodeViewWrapper
      className="group/media relative my-6"
      contentEditable={false}
      data-media-type={mediaType}
    >
      {isEditable && (
        <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 rounded-lg border border-border bg-background/90 px-1.5 py-1 opacity-0 backdrop-blur-sm transition-opacity group-hover/media:opacity-100 focus-within:opacity-100">
          {MEDIA_BLOCK_TYPES.map((typeOption) => (
            <button
              key={typeOption}
              type="button"
              onClick={() => updateAttributes({ type: typeOption })}
              className={cn(
                "rounded px-1.5 py-0.5 text-[11px] capitalize transition-colors",
                mediaType === typeOption
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {typeOption}
            </button>
          ))}

          {mediaType !== "audio" && (
            <>
              <span className="mx-0.5 h-3 w-px bg-border" />
              <select
                aria-label="Image fit"
                value={fit}
                onChange={(e) =>
                  updateAttributes({ fit: normalizeImageFit(e.target.value) })
                }
                className="cursor-pointer rounded bg-transparent px-1 py-0.5 text-[11px] text-muted-foreground hover:text-foreground focus:outline-none"
              >
                <option value="cover">Cover</option>
                <option value="contain">Contain</option>
              </select>
            </>
          )}

          {url && (
            <>
              <span className="mx-0.5 h-3 w-px bg-border" />
              <button
                type="button"
                onClick={() => {
                  setUrlInput(url)
                  setIsEditingUrl((prev) => !prev)
                }}
                className="rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
              >
                URL
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
              >
                Replace
              </button>
            </>
          )}
          <button
            type="button"
            onClick={deleteNode}
            className="inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:text-destructive"
            title="Delete media"
            aria-label="Delete media"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      )}

      {isEditingUrl && isEditable && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-border px-3 py-1.5">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                commitUrl(urlInput)
              }
              if (e.key === "Escape") {
                setIsEditingUrl(false)
              }
            }}
            placeholder={
              mediaType === "video"
                ? "Paste video or YouTube URL and press Enter..."
                : `Paste ${mediaType} URL and press Enter...`
            }
            autoFocus
            className="min-w-0 flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <button
            type="button"
            onClick={() => commitUrl(urlInput)}
            className="text-xs font-medium text-foreground hover:underline"
          >
            Apply
          </button>
        </div>
      )}

      <div
        onDragEnter={(event) => {
          if (!isEditable) return
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragOver={(event) => {
          if (!isEditable) return
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={(event) => {
          if (!isEditable) return
          event.preventDefault()
          setIsDragging(false)
        }}
        onDrop={handleDrop}
        className={cn(
          "relative overflow-hidden rounded-xl",
          isDragging && "outline-2 outline-dashed outline-primary",
        )}
      >
        {url ? (
          mediaType === "image" ? (
            <div className="aspect-4/3 w-full overflow-hidden rounded-xl border border-border bg-muted/20">
              <img
                src={url}
                alt={alt || "Media"}
                className={cn(
                  "!m-0 !border-0 !rounded-none !shadow-none block h-full w-full",
                  fit === "contain" ? "object-contain" : "object-cover",
                )}
              />
            </div>
          ) : mediaType === "video" ? (
            youtubeEmbedUrl ? (
              <div className="aspect-4/3 w-full overflow-hidden rounded-xl border border-border bg-black">
                <iframe
                  src={youtubeEmbedUrl}
                  title={alt || "Embedded video"}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full border-0"
                />
              </div>
            ) : (
              <div className="aspect-4/3 w-full overflow-hidden rounded-xl border border-border bg-black">
                <video
                  src={url}
                  controls
                  className={cn(
                    "h-full w-full",
                    fit === "contain" ? "object-contain" : "object-cover",
                  )}
                />
              </div>
            )
          ) : (
            <div className="rounded-xl border border-border p-3">
              <audio src={url} controls className="h-9 w-full" />
            </div>
          )
        ) : (
          <div className="flex aspect-4/3 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 text-center">
            <button
              type="button"
              disabled={!isEditable || isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:cursor-default"
            >
              {isUploading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Upload className="size-3.5" />
              )}
              <span>
                {isUploading
                  ? "Uploading..."
                  : `Drop ${mediaType} or click to upload`}
              </span>
            </button>
            {isEditable && (
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    commitUrl(urlInput)
                  }
                }}
                onBlur={() => {
                  if (urlInput.trim()) commitUrl(urlInput)
                }}
                placeholder={
                  mediaType === "video"
                    ? "Or paste a video / YouTube URL..."
                    : `Or paste ${mediaType} URL...`
                }
                className="w-full max-w-sm bg-transparent text-center text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
              />
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={MEDIA_ACCEPT[mediaType]}
          className="hidden"
          onChange={(event) => void uploadMediaFile(event.target.files?.[0])}
        />
      </div>

      {(alt || isEditable) && (
        <div
          className={cn(
            "mt-1.5 transition-opacity",
            !alt &&
              "opacity-0 group-hover/media:opacity-100 focus-within:opacity-100",
          )}
        >
          {isEditable ? (
            <input
              type="text"
              value={alt}
              onChange={(e) => updateAttributes({ alt: e.target.value })}
              placeholder="Add a caption..."
              className="w-full bg-transparent text-xs text-muted-foreground placeholder:text-muted-foreground/50 focus:text-foreground focus:outline-none"
            />
          ) : (
            alt && <p className="!m-0 text-xs text-muted-foreground">{alt}</p>
          )}
        </div>
      )}
    </NodeViewWrapper>
  )
}
