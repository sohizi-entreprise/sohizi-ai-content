import { mergeAttributes } from '@tiptap/core'
import Mention from '@tiptap/extension-mention'
import { ReactRenderer } from '@tiptap/react'
import { computePosition, flip, shift } from '@floating-ui/dom'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { SuggestionOptions, SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion'
import type { Editor } from '@tiptap/core'
import { toast } from 'sonner'
import type { FileMentionItem } from '@/hooks/use-file-mention-search'
import { FileMentionList } from './file-mention-list'
import { useEditorStore } from '../stores/editor-store'

export const FILE_MENTION_REGEX =
  /@\[([^\]]+)\]\(file:([^?)\s]+)\?format=([^)]+)\)/g

const FILE_MENTION_PATTERN =
  /^@\[([^\]]+)\]\(file:([^?)\s]+)\?format=([^)]+)\)/

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export const FileMention = Mention.extend({
  name: 'fileMention',

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-id'),
        renderHTML: (attrs) => ({ 'data-id': attrs.id }),
      },
      label: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-label'),
        renderHTML: (attrs) => ({ 'data-label': attrs.label }),
      },
      format: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-format'),
        renderHTML: (attrs) => ({ 'data-format': attrs.format }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-type="fileMention"][data-format]' }]
  },

  renderText({ node }) {
    return `@${node.attrs.label ?? node.attrs.id ?? ''}`
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(
        { 'data-type': 'fileMention' },
        HTMLAttributes,
        this.options.HTMLAttributes,
      ),
      `@${node.attrs.label ?? node.attrs.id ?? ''}`,
    ]
  },

  renderMarkdown(node) {
    const label = node.attrs?.label ?? ''
    const id = node.attrs?.id ?? ''
    const format = node.attrs?.format ?? ''
    return `@[${label}](file:${id}?format=${format})`
  },

  markdownTokenizer: {
    name: 'fileMention',
    level: 'inline',
    start: (src) => src.indexOf('@['),
    tokenize: (src) => {
      const match = FILE_MENTION_PATTERN.exec(src)
      if (!match) return undefined

      return {
        type: 'fileMention',
        raw: match[0],
        label: match[1],
        id: match[2],
        format: match[3],
      }
    },
  },

  parseMarkdown: (token) => ({
    type: 'fileMention',
    attrs: {
      id: token.id,
      label: token.label,
      format: token.format,
    },
  }),

  addPasteRules() {
    return [
      {
        find: FILE_MENTION_REGEX,
        handler: ({ match, chain, range }) => {
          const label = match[1]
          const id = match[2]
          const format = match[3]
          chain().deleteRange(range).insertContentAt(range.from, {
            type: this.name,
            attrs: { id, label, format },
          })
        },
      },
    ]
  },

  addProseMirrorPlugins() {
    const parentPlugins = this.parent?.() ?? []

    return [
      ...parentPlugins,
      new Plugin({
        key: new PluginKey('fileMentionClick'),
        props: {
          handleClick: (_view, _pos, event) => {
            const target = event.target
            if (!(target instanceof HTMLElement)) return false

            const mention = target.closest('[data-type="fileMention"]')
            if (!mention) return false

            const id = mention.getAttribute('data-id')
            const label = mention.getAttribute('data-label')
            const format = mention.getAttribute('data-format')

            if (!id || !label || !format) {
              toast.error('Invalid file mention')
              return true
            }

            event.preventDefault()
            useEditorStore.getState().openFileFromMention({ id, label, format })
            return true
          },
        },
      }),
    ]
  },
})

export function preprocessFileMentions(markdown: string): string {
  return markdown.replace(
    FILE_MENTION_REGEX,
    (_match, label, id, format) => {
      return `<span data-type="fileMention" data-id="${escapeHtmlAttribute(id)}" data-label="${escapeHtmlAttribute(label)}" data-format="${escapeHtmlAttribute(format)}" class="file-mention">@${label}</span>`
    },
  )
}

type FileMentionListRef = {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

function updatePosition(editor: Editor, element: HTMLElement) {
  const { from, to } = editor.state.selection
  const virtualElement = {
    getBoundingClientRect: () => {
      const { view } = editor
      const start = view.coordsAtPos(from)
      const end = view.coordsAtPos(to)
      return new DOMRect(start.left, start.top, end.right - start.left, end.bottom - start.top)
    },
  }

  computePosition(virtualElement, element, {
    placement: 'bottom-start',
    strategy: 'fixed',
    middleware: [shift(), flip()],
  }).then(({ x, y }) => {
    element.style.width = 'max-content'
    element.style.position = 'fixed'
    element.style.left = `${x}px`
    element.style.top = `${y}px`
  })
}

export function createFileMentionSuggestion(
  searchFn: (query: string, options?: { signal?: AbortSignal }) => Promise<FileMentionItem[]>,
): Omit<SuggestionOptions<FileMentionItem>, 'editor'> {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let abortController: AbortController | null = null

  return {
    char: '@',
    allowSpaces: false,

    items: ({ query }) => {
      return new Promise<FileMentionItem[]>((resolve) => {
        if (debounceTimer) clearTimeout(debounceTimer)
        if (abortController) abortController.abort()

        if (!query.trim()) {
          resolve([])
          return
        }

        debounceTimer = setTimeout(async () => {
          abortController = new AbortController()
          try {
            const results = await searchFn(query, { signal: abortController.signal })
            resolve(results)
          } catch {
            resolve([])
          }
        }, 200)
      })
    },

    command: ({ editor, range, props }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: 'fileMention',
          attrs: {
            id: props.id,
            label: props.display,
            format: props.format,
          },
        })
        .insertContent(' ')
        .run()
    },

    render: () => {
      let component: ReactRenderer<FileMentionListRef, SuggestionProps<FileMentionItem>> | null = null
      let scrollHandler: (() => void) | null = null

      return {
        onStart: (props) => {
          component = new ReactRenderer(FileMentionList, {
            props,
            editor: props.editor,
          })

          if (!props.clientRect) return

          component.element.style.position = 'fixed'
          component.element.style.zIndex = '50'
          document.body.appendChild(component.element)
          updatePosition(props.editor, component.element)

          scrollHandler = () => {
            if (component) updatePosition(props.editor, component.element)
          }
          window.addEventListener('scroll', scrollHandler, true)
        },

        onUpdate(props) {
          component?.updateProps(props)
          if (!props.clientRect) return
          if (component) updatePosition(props.editor, component.element)
        },

        onKeyDown(props) {
          if (props.event.key === 'Escape') {
            component?.destroy()
            return true
          }
          return component?.ref?.onKeyDown(props) ?? false
        },

        onExit() {
          if (scrollHandler) {
            window.removeEventListener('scroll', scrollHandler, true)
            scrollHandler = null
          }
          if (debounceTimer) clearTimeout(debounceTimer)
          if (abortController) abortController.abort()
          component?.destroy()
          component = null
        },
      }
    },
  }
}
