import { Node, mergeAttributes } from '@tiptap/core'
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from '@tiptap/react'
import { ImageIcon, Loader2, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { useFileTreeStore } from '../stores/file-tree-store'
import type { ReactNodeViewProps } from '@tiptap/react'
import type { DragEvent } from 'react'
import { cn } from '@/lib/utils'
import api from '@/lib/axios'
import { saveFileToBucket } from '@/hooks/use-save-file-bucket'

export const IMAGE_LAYOUTS = [
  'single',
  'double-horizontal',
  'image-left-content',
  'image-right-content',
] as const

export type ImageLayoutType = (typeof IMAGE_LAYOUTS)[number]

type ImageLayoutImage = {
  url: string
  name: string
}

type AssetFileContent = {
  type: string
  url: string
  name: string
  storageKey: string
}

declare module '@tiptap/core' {
  // Tiptap's command augmentation requires this exact generic name across declarations.
  // eslint-disable-next-line @typescript-eslint/naming-convention
  interface Commands<ReturnType> {
    imageLayout: {
      insertImageLayout: (attrs: { layout: ImageLayoutType }) => ReturnType
    }
  }
}

export const ImageLayout = Node.create({
  name: 'imageLayout',

  group: 'block',

  content: 'block*',

  isolating: true,

  addAttributes() {
    return {
      layout: {
        default: 'single',
        parseHTML: (element) =>
          normalizeLayout(element.getAttribute('data-layout')),
        renderHTML: (attrs) => ({
          'data-layout': normalizeLayout(attrs.layout),
        }),
      },
      images: {
        default: [],
        parseHTML: (element) => parseImagesAttribute(element),
        renderHTML: (attrs) => ({
          'data-images': JSON.stringify(normalizeImages(attrs.images)),
        }),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="image-layout"]',
        contentElement: (element) =>
          element.querySelector<HTMLElement>('[data-slot="content"]') ??
          createEmptyContentElement(element),
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'image-layout',
        class: 'image-layout-block',
      }),
      0,
    ]
  },

  renderMarkdown(node, helpers) {
    const layout = normalizeLayout(node.attrs?.layout)
    const images = normalizeImages(node.attrs?.images)

    const content = helpers.renderChildren(node.content ?? []).trim()
    const imageMarkup = images
      .map((image, index) => {
        if (!image.url) return ''
        return `<img src="${escapeAttribute(image.url)}" alt="${escapeAttribute(image.name || `Image ${index + 1}`)}" />`
      })
      .join('')

    return [
      `<div data-type="image-layout" data-layout="${layout}" data-images="${escapeAttribute(JSON.stringify(images))}">`,
      imageMarkup,
      `<div data-slot="content">${content || '<p></p>'}</div>`,
      '</div>',
      '',
      '',
    ].join('\n')
  },

  addCommands() {
    return {
      insertImageLayout:
        ({ layout }) =>
        ({ commands }) => {
          const normalizedLayout = normalizeLayout(layout)
          const imageCount = normalizedLayout === 'double-horizontal' ? 2 : 1
          const content =
            normalizedLayout === 'image-left-content' ||
            normalizedLayout === 'image-right-content'
              ? [{ type: 'paragraph' }]
              : []

          return commands.insertContent({
            type: this.name,
            attrs: {
              layout: normalizedLayout,
              images: Array.from({ length: imageCount }, () => ({
                url: '',
                name: '',
              })),
            },
            content,
          })
        },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageLayoutView)
  },
})

function ImageLayoutView({
  deleteNode,
  node,
  updateAttributes,
}: ReactNodeViewProps) {
  const layout = normalizeLayout(node.attrs.layout)
  const images = normalizeImages(node.attrs.images)
  const slotCount = layout === 'double-horizontal' ? 2 : 1
  const hasContent =
    layout === 'image-left-content' || layout === 'image-right-content'
  const slots = Array.from(
    { length: slotCount },
    (_, index) => images[index] ?? { url: '', name: '' },
  )

  const updateImage = (index: number, image: ImageLayoutImage) => {
    const nextImages = [...slots]
    nextImages[index] = image
    updateAttributes({ images: nextImages })
  }

  return (
    <NodeViewWrapper
      className={cn(
        'image-layout-node',
        `image-layout-node-${layout}`,
        hasContent && 'image-layout-node-with-content',
      )}
      data-layout={layout}
    >
      <button
        type="button"
        className="image-layout-delete"
        title="Delete image layout"
        aria-label="Delete image layout"
        contentEditable={false}
        onClick={deleteNode}
      >
        <Trash2 className="size-3.5" />
      </button>
      <div className="image-layout-media" contentEditable={false}>
        {slots.map((image, index) => (
          <ImageUploadSlot
            key={index}
            image={image}
            label={slotCount > 1 ? `Image ${index + 1}` : 'Image'}
            onUploaded={(uploadedImage) => updateImage(index, uploadedImage)}
          />
        ))}
      </div>
      {hasContent && (
        <div className="image-layout-content">
          <NodeViewContent />
        </div>
      )}
    </NodeViewWrapper>
  )
}

function ImageUploadSlot({
  image,
  label,
  onUploaded,
}: {
  image: ImageLayoutImage
  label: string
  onUploaded: (image: ImageLayoutImage) => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const projectId = useFileTreeStore((s) => s.projectId)
  const rootFolderId = useFileTreeStore((s) => s.rootFolderId)
  const insertNodeAt = useFileTreeStore((s) => s.insertNodeAt)

  const uploadImage = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file.')
      return
    }
    if (!projectId || !rootFolderId) {
      toast.error('Project file tree is not ready yet.')
      return
    }

    setIsUploading(true)
    try {
      const result = await saveFileToBucket({
        projectId,
        folderId: rootFolderId,
        file,
      })
      insertNodeAt(rootFolderId, result.fileNode)

      const { data: content } = await api.get<AssetFileContent>(
        `/projects/${projectId}/files/${result.fileNode.id}`,
      )

      onUploaded({
        url: content.url,
        name: content.name || file.name,
      })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to upload image.',
      )
    } finally {
      setIsUploading(false)
      if (inputRef.current) {
        inputRef.current.value = ''
      }
    }
  }

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault()
    setIsDragging(false)
    void uploadImage(event.dataTransfer.files[0])
  }

  return (
    <button
      type="button"
      className={cn(
        'image-upload-slot',
        isDragging && 'image-upload-slot-dragging',
      )}
      onClick={() => inputRef.current?.click()}
      onDragEnter={(event) => {
        event.preventDefault()
        setIsDragging(true)
      }}
      onDragOver={(event) => {
        event.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={(event) => {
        event.preventDefault()
        setIsDragging(false)
      }}
      onDrop={handleDrop}
      disabled={isUploading}
    >
      {image.url ? (
        <img src={image.url} alt={image.name || label} />
      ) : (
        <span className="image-upload-placeholder">
          {isUploading ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <ImageIcon className="size-5" />
          )}
          <span>{isUploading ? 'Uploading...' : `Upload ${label}`}</span>
          <span className="image-upload-hint">
            <Upload className="size-3" />
            Drop image or click to browse
          </span>
        </span>
      )}
      {image.url && (
        <span className="image-upload-replace">
          <Upload className="size-3" />
          Replace
        </span>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => void uploadImage(event.target.files?.[0])}
      />
    </button>
  )
}

function normalizeLayout(value: unknown): ImageLayoutType {
  return IMAGE_LAYOUTS.includes(value as ImageLayoutType)
    ? (value as ImageLayoutType)
    : 'single'
}

function normalizeImages(value: unknown): Array<ImageLayoutImage> {
  if (!Array.isArray(value)) return []

  return value.map((image) => {
    if (typeof image === 'string') {
      return { url: image, name: '' }
    }

    if (image && typeof image === 'object') {
      const attrs = image as Record<string, unknown>
      return {
        url: typeof attrs.url === 'string' ? attrs.url : '',
        name: typeof attrs.name === 'string' ? attrs.name : '',
      }
    }

    return { url: '', name: '' }
  })
}

function parseImagesAttribute(element: HTMLElement): Array<ImageLayoutImage> {
  const imagesJson = element.getAttribute('data-images')
  if (imagesJson) {
    try {
      return normalizeImages(JSON.parse(imagesJson))
    } catch {
      return []
    }
  }

  return Array.from(element.querySelectorAll('img')).map((image) => ({
    url: image.getAttribute('src') ?? '',
    name: image.getAttribute('alt') ?? '',
  }))
}

function createEmptyContentElement(element: HTMLElement) {
  const container = element.ownerDocument.createElement('div')
  container.setAttribute('data-slot', 'content')
  container.appendChild(element.ownerDocument.createElement('p'))
  return container
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replaceAll('"', '&quot;')
}
