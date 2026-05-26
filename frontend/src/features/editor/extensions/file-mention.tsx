import { mergeAttributes } from '@tiptap/core'
import Mention from '@tiptap/extension-mention'
import { ReactRenderer } from '@tiptap/react'
import { computePosition, flip, shift } from '@floating-ui/dom'
import type { SuggestionOptions, SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion'
import type { Editor } from '@tiptap/core'
import type { FileMentionItem } from '@/hooks/use-file-mention-search'
import { FileMentionList } from './file-mention-list'

const FILE_MENTION_REGEX = /@\[([^\]]+)\]\(file:([^)]+)\)/g

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
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-type="fileMention"]' }]
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
    return `@[${label}](file:${id})`
  },

  addPasteRules() {
    return [
      {
        find: FILE_MENTION_REGEX,
        handler: ({ match, chain, range }) => {
          const label = match[1]
          const id = match[2]
          chain().deleteRange(range).insertContentAt(range.from, {
            type: this.name,
            attrs: { id, label },
          })
        },
      },
    ]
  },
})

export function preprocessFileMentions(markdown: string): string {
  return markdown.replace(FILE_MENTION_REGEX, (_match, label, id) => {
    return `<span data-type="fileMention" data-id="${id}" data-label="${label}">@${label}</span>`
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
