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
import type { RefObject } from "react"
import type { CommandMentionItem } from "@/hooks/use-command-mention-search"

const CommandMentionExtension = Mention.extend({
  name: "commandMention",

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-id"),
        renderHTML: (attrs) => (attrs.id ? { "data-id": attrs.id } : {}),
      },
      name: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-name"),
        renderHTML: (attrs) => ({ "data-name": attrs.name }),
      },
      display: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-display"),
        renderHTML: (attrs) =>
          attrs.display ? { "data-display": attrs.display } : {},
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-type="commandMention"][data-name]' }]
  },

  renderText({ node }) {
    return `/${node.attrs.display ?? node.attrs.name ?? ""}`
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(
        { "data-type": "commandMention" },
        HTMLAttributes,
        this.options.HTMLAttributes,
      ),
      `/${node.attrs.display ?? node.attrs.name ?? ""}`,
    ]
  },

  renderMarkdown(node) {
    const label = node.attrs?.display ?? node.attrs?.name ?? ""
    return `/${label}`
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

export function collectCommandsFromChatEditor(
  editor: Editor | null,
): Array<string> {
  if (!editor) return []
  const commands: Array<string> = []
  const seen = new Set<string>()

  editor.state.doc.descendants((node) => {
    if (node.type.name !== "commandMention") return
    const id =
      typeof node.attrs.id === "string" && node.attrs.id.trim()
        ? node.attrs.id.trim()
        : typeof node.attrs.name === "string" && node.attrs.name.trim()
          ? node.attrs.name.trim()
          : null
    if (id && !seen.has(id)) {
      seen.add(id)
      commands.push(id)
    }
  })

  return commands
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
  anchorRef?: RefObject<HTMLElement | null>,
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
            id: props.id,
            name: props.name,
            display: props.display,
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

          component.element.style.zIndex = "50"
          const anchor = anchorRef?.current
          if (anchor) {
            component.element.style.position = "absolute"
            component.element.style.left = "0"
            component.element.style.bottom = "calc(100% + 8px)"
            component.element.style.width = "100%"
            anchor.appendChild(component.element)
            return
          }

          if (!props.clientRect) return

          component.element.style.position = "fixed"
          document.body.appendChild(component.element)
          updatePosition(props.editor, component.element)

          scrollHandler = () => {
            if (component) updatePosition(props.editor, component.element)
          }
          window.addEventListener("scroll", scrollHandler, true)
        },

        onUpdate(props) {
          component?.updateProps(props)
          if (anchorRef?.current) return
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
