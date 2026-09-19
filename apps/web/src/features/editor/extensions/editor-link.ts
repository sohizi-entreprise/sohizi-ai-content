import { mergeAttributes } from "@tiptap/core"
import Link from "@tiptap/extension-link"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { useEditorStore } from "../stores/editor-store"
import { toProjectFilePath } from "@/lib/file-tag"

export const EditorLink = Link.extend({
  inclusive: false,

  addAttributes() {
    return {
      ...this.parent?.(),
      selection: {
        default: null,
        parseHTML: () => null,
        renderHTML: () => ({}),
      },
    }
  },

  renderHTML({ HTMLAttributes }) {
    const path = toProjectFilePath(HTMLAttributes.href)
    return [
      "a",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: path ? "file-tag-link" : undefined,
      }),
      0,
    ]
  },

  addProseMirrorPlugins() {
    const parentPlugins = this.parent?.() ?? []

    return [
      new Plugin({
        key: new PluginKey("filePathLinkClick"),
        props: {
          handleClick: (_view, _pos, event) => {
            const target = event.target
            if (!(target instanceof HTMLElement)) return false

            const anchor = target.closest("a")
            if (!anchor) return false

            const path = toProjectFilePath(
              anchor.getAttribute("href") ?? anchor.href,
            )
            if (!path) return false

            event.preventDefault()
            event.stopPropagation()
            void useEditorStore.getState().openFileByPath(path)
            return true
          },
        },
      }),
      ...parentPlugins,
    ]
  },
}).configure({
  openOnClick: false,
  enableClickSelection: false,
  HTMLAttributes: {
    rel: "noopener noreferrer",
  },
})
