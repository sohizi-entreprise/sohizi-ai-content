import Link from "@tiptap/extension-link"

export const EditorLink = Link.extend({
  inclusive: false,
}).configure({
  openOnClick: true,
  enableClickSelection: false,
  HTMLAttributes: {
    target: "_blank",
    rel: "noopener noreferrer",
  },
})
