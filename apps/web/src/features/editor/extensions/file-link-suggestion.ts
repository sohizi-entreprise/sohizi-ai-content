import { Extension } from "@tiptap/core"
import { ReactRenderer } from "@tiptap/react"
import { computePosition, flip, shift } from "@floating-ui/dom"
import { PluginKey } from "@tiptap/pm/state"
import Suggestion from "@tiptap/suggestion"
import { FileMentionList } from "./file-mention-list"
import type {
  SuggestionKeyDownProps,
  SuggestionOptions,
  SuggestionProps,
} from "@tiptap/suggestion"
import type { Editor } from "@tiptap/core"
import type { RefObject } from "react"
import type { FileMentionItem } from "@/hooks/use-file-mention-search"

const FILE_LINK_SUGGESTION_PLUGIN_KEY = new PluginKey("fileLinkSuggestion")

type FileMentionListRef = {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

export const FileLinkSuggestion = Extension.create<{
  suggestion: Omit<SuggestionOptions<FileMentionItem>, "editor">
}>({
  name: "fileLinkSuggestion",

  addOptions() {
    return {
      suggestion: {
        char: "@",
        command: () => {},
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        pluginKey: FILE_LINK_SUGGESTION_PLUGIN_KEY,
      }),
    ]
  },
})

function updatePosition(editor: Editor, element: HTMLElement) {
  element.style.width = "min(20rem, calc(100vw - 16px))"
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
    element.style.position = "fixed"
    element.style.left = `${x}px`
    element.style.top = `${y}px`
  })
}

export function createFileLinkSuggestion(
  searchFn: (
    query: string,
    options?: { signal?: AbortSignal },
  ) => Promise<Array<FileMentionItem>>,
  anchorRef?: RefObject<HTMLElement | null>,
): Omit<SuggestionOptions<FileMentionItem>, "editor"> {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let abortController: AbortController | null = null

  return {
    char: "@",
    allowSpaces: false,

    items: ({ query }) => {
      return new Promise<Array<FileMentionItem>>((resolve) => {
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
          type: "text",
          text: props.display,
          marks: [{ type: "link", attrs: { href: props.path } }],
        })
        .insertContent(" ")
        .run()
    },

    render: () => {
      let component: ReactRenderer<
        FileMentionListRef,
        SuggestionProps<FileMentionItem>
      > | null = null
      let scrollHandler: (() => void) | null = null

      return {
        onStart: (props) => {
          component = new ReactRenderer(FileMentionList, {
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
