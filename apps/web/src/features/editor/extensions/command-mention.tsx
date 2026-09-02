import { mergeAttributes } from "@tiptap/core"
import Mention from "@tiptap/extension-mention"
import { ReactRenderer } from "@tiptap/react"
import { computePosition, flip, shift } from "@floating-ui/dom"
import { CommandMentionList } from "./command-mention-list"
import type {
  SuggestionKeyDownProps,
  SuggestionOptions,
  SuggestionProps,
} from "@tiptap/suggestion"
import type { Editor } from "@tiptap/core"
import type { CommandMentionItem } from "@/hooks/use-command-mention-search"

export const COMMAND_MENTION_REGEX = /#\[command=([^\]]+)\]/g

const COMMAND_MENTION_PATTERN = /^#\[command=([^\]]+)\]/

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

const CommandMentionExtension = Mention.extend({
  name: "commandMention",

  addAttributes() {
    return {
      name: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-name"),
        renderHTML: (attrs) => ({ "data-name": attrs.name }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-type="commandMention"][data-name]' }]
  },

  renderText({ node }) {
    return `/${node.attrs.name ?? ""}`
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(
        { "data-type": "commandMention" },
        HTMLAttributes,
        this.options.HTMLAttributes,
      ),
      `/${node.attrs.name ?? ""}`,
    ]
  },

  renderMarkdown(node) {
    const name = node.attrs?.name ?? ""
    return `#[command=${name}]`
  },

  markdownTokenizer: {
    name: "commandMention",
    level: "inline",
    start: (src) => src.indexOf("#["),
    tokenize: (src) => {
      const match = COMMAND_MENTION_PATTERN.exec(src)
      if (!match) return undefined

      return {
        type: "commandMention",
        raw: match[0],
        name: match[1],
      }
    },
  },

  parseMarkdown: (token) => ({
    type: "commandMention",
    attrs: {
      name: token.name,
    },
  }),

  addPasteRules() {
    return [
      {
        find: COMMAND_MENTION_REGEX,
        handler: ({ match, chain, range }) => {
          const name = match[1]
          chain().deleteRange(range).insertContentAt(range.from, {
            type: this.name,
            attrs: { name },
          })
        },
      },
    ]
  },
})

export const CommandMention = CommandMentionExtension as Omit<
  typeof CommandMentionExtension,
  "configure"
> & {
  configure: (
    options?: Partial<NonNullable<Parameters<typeof Mention.configure>[0]>>,
  ) => ReturnType<typeof CommandMentionExtension.configure>
}

export function preprocessCommandMentions(markdown: string): string {
  return markdown.replace(COMMAND_MENTION_REGEX, (_match, name) => {
    return `<span data-type="commandMention" data-name="${escapeHtmlAttribute(name)}" class="command-mention">/${name}</span>`
  })
}

type CommandMentionListRef = {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

function updatePosition(editor: Editor, element: HTMLElement) {
  const { from, to } = editor.state.selection
  const virtualElement = {
    getBoundingClientRect: () => {
      const { view } = editor
      const start = view.coordsAtPos(from)
      const end = view.coordsAtPos(to)
      return new DOMRect(
        start.left,
        start.top,
        end.right - start.left,
        end.bottom - start.top,
      )
    },
  }

  computePosition(virtualElement, element, {
    placement: "bottom-start",
    strategy: "fixed",
    middleware: [shift(), flip()],
  }).then(({ x, y }) => {
    element.style.width = "max-content"
    element.style.position = "fixed"
    element.style.left = `${x}px`
    element.style.top = `${y}px`
  })
}

export function createCommandMentionSuggestion(
  searchFn: (
    query: string,
    options?: { signal?: AbortSignal },
  ) => Promise<Array<CommandMentionItem>>,
): Omit<SuggestionOptions<CommandMentionItem>, "editor"> {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let abortController: AbortController | null = null

  return {
    char: "/",
    allowSpaces: false,

    items: ({ query }) => {
      return new Promise<Array<CommandMentionItem>>((resolve) => {
        if (debounceTimer) clearTimeout(debounceTimer)
        if (abortController) abortController.abort()

        if (!query.trim()) {
          resolve([])
          return
        }

        debounceTimer = setTimeout(async () => {
          abortController = new AbortController()
          try {
            const results = await searchFn(query, {
              signal: abortController.signal,
            })
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
          type: "commandMention",
          attrs: {
            name: props.name,
          },
        })
        .insertContent(" ")
        .run()
    },

    render: () => {
      let component: ReactRenderer<
        CommandMentionListRef,
        SuggestionProps<CommandMentionItem>
      > | null = null
      let scrollHandler: (() => void) | null = null

      return {
        onStart: (props) => {
          component = new ReactRenderer(CommandMentionList, {
            props,
            editor: props.editor,
          })

          if (!props.clientRect) return

          component.element.style.position = "fixed"
          component.element.style.zIndex = "50"
          document.body.appendChild(component.element)
          updatePosition(props.editor, component.element)

          scrollHandler = () => {
            if (component) updatePosition(props.editor, component.element)
          }
          window.addEventListener("scroll", scrollHandler, true)
        },

        onUpdate(props) {
          component?.updateProps(props)
          if (!props.clientRect) return
          if (component) updatePosition(props.editor, component.element)
        },

        onKeyDown(props) {
          if (props.event.key === "Escape") {
            component?.destroy()
            return true
          }
          return component?.ref?.onKeyDown(props) ?? false
        },

        onExit() {
          if (scrollHandler) {
            window.removeEventListener("scroll", scrollHandler, true)
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
