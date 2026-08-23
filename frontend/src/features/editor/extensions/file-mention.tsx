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
import {
  FILE_TAG_REGEX,
  formatFileTag,
  parseFileTag,
} from '@/lib/file-tag'

type MentionConfigureOptions = NonNullable<Parameters<typeof Mention.configure>[0]>
type FileMentionOptions = MentionConfigureOptions & {
  enableClick: boolean
}

export const FILE_MENTION_REGEX = FILE_TAG_REGEX

const FILE_MENTION_PATTERN =
  /^@\[([^\]]+)\]\(file:([^?)\s]+)\?([^)]+)\)/

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function mentionLabel(attrs: {
  label?: string | null
  id?: string | null
  lines?: string | null
}): string {
  const base = attrs.label ?? attrs.id ?? ''
  return attrs.lines ? `${base} ${attrs.lines}` : base
}

const FileMentionExtension = Mention.extend<FileMentionOptions>({
  name: 'fileMention',

  addOptions() {
    return {
      ...this.parent?.(),
      enableClick: true,
    }
  },

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
      lines: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-lines'),
        renderHTML: (attrs) =>
          attrs.lines ? { 'data-lines': attrs.lines } : {},
      },
      snippet: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-snippet'),
        renderHTML: (attrs) =>
          attrs.snippet ? { 'data-snippet': attrs.snippet } : {},
      },
      selection: {
        default: null,
        parseHTML: () => null,
        renderHTML: () => ({}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-type="fileMention"][data-format]' }]
  },

  renderText({ node }) {
    return `@${mentionLabel(node.attrs)}`
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(
        { 'data-type': 'fileMention' },
        HTMLAttributes,
        this.options.HTMLAttributes ?? {},
      ),
      `@${mentionLabel(node.attrs)}`,
    ]
  },

  renderMarkdown(node) {
    return formatFileTag({
      displayName: node.attrs?.label ?? '',
      fileId: node.attrs?.id ?? '',
      format: node.attrs?.format ?? '',
      lines: node.attrs?.lines,
    })
  },

  markdownTokenizer: {
    name: 'fileMention',
    level: 'inline',
    start: (src) => src.indexOf('@['),
    tokenize: (src) => {
      const match = FILE_MENTION_PATTERN.exec(src)
      if (!match) return undefined

      const parsed = parseFileTag(match[0])
      if (!parsed) return undefined

      return {
        type: 'fileMention',
        raw: match[0],
        label: parsed.displayName,
        id: parsed.fileId,
        format: parsed.format,
        lines: parsed.lines ?? null,
        snippet: parsed.snippet ?? null,
      }
    },
  },

  parseMarkdown: (token) => ({
    type: 'fileMention',
    attrs: {
      id: token.id,
      label: token.label,
      format: token.format,
      lines: token.lines ?? null,
      snippet: token.snippet ?? null,
    },
  }),

  addPasteRules() {
    return [
      {
        find: FILE_MENTION_REGEX,
        handler: ({ match, chain, range }) => {
          const parsed = parseFileTag(match[0])
          if (!parsed) return

          chain().deleteRange(range).insertContentAt(range.from, {
            type: this.name,
            attrs: {
              id: parsed.fileId,
              label: parsed.displayName,
              format: parsed.format,
              lines: parsed.lines ?? null,
              snippet: parsed.snippet ?? null,
            },
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
            if (!this.options.enableClick) return false

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

export const FileMention = FileMentionExtension as Omit<
  typeof FileMentionExtension,
  'configure'
> & {
  configure: (
    options?: Partial<FileMentionOptions>,
  ) => ReturnType<typeof FileMentionExtension.configure>
}

export function preprocessFileMentions(markdown: string): string {
  return markdown.replace(FILE_MENTION_REGEX, (match) => {
    const parsed = parseFileTag(match)
    if (!parsed) return match

    const linesAttr = parsed.lines
      ? ` data-lines="${escapeHtmlAttribute(parsed.lines)}"`
      : ''
    const snippetAttr = parsed.snippet
      ? ` data-snippet="${escapeHtmlAttribute(parsed.snippet)}"`
      : ''

    return `<span data-type="fileMention" data-id="${escapeHtmlAttribute(parsed.fileId)}" data-label="${escapeHtmlAttribute(parsed.displayName)}" data-format="${escapeHtmlAttribute(parsed.format)}"${linesAttr}${snippetAttr} class="file-mention">@${mentionLabel({ label: parsed.displayName, lines: parsed.lines })}</span>`
  })
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
