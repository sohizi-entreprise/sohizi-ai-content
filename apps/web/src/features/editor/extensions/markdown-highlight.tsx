import { Highlight } from "@tiptap/extension-highlight"

export const MarkdownHighlight = Highlight.configure({
  HTMLAttributes: {
    class: "text-highlight",
  },
})
