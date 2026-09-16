import { Extension, markPasteRule } from "@tiptap/core"
import Link from "@tiptap/extension-link"
import { Placeholder } from "@tiptap/extension-placeholder"
import { Markdown } from "@tiptap/markdown"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { useEffect, useMemo, useRef } from "react"
import type { Editor } from "@tiptap/core"
import type { ClassValue } from "clsx"
import { cn } from "@/lib/utils"

const URL_PASTE_REGEX = /https?:\/\/[^\s<>"']+/gi

const StoryIdeaLink = Link.extend({
  inclusive: false,
  addPasteRules() {
    return [
      markPasteRule({
        find: URL_PASTE_REGEX,
        type: this.type,
        getAttributes: (match) => ({ href: match[0] }),
      }),
    ]
  },
}).configure({
  autolink: true,
  linkOnPaste: true,
  openOnClick: true,
  HTMLAttributes: {
    target: "_blank",
    rel: "noopener noreferrer",
  },
})

type StoryIdeaEditorProps = {
  onChange: (content: string) => void
  onSubmit?: () => void
  placeholder?: string
  className?: ClassValue
  ref?: (editor: Editor) => void
}

export default function StoryIdeaEditor({
  onChange,
  onSubmit,
  placeholder = "Share your idea with me, or pick a setting to get started quickly.",
  className,
  ref,
}: StoryIdeaEditorProps) {
  const onSubmitRef = useRef(onSubmit)
  useEffect(() => {
    onSubmitRef.current = onSubmit
  }, [onSubmit])

  const submitOnEnter = useMemo(
    () =>
      Extension.create({
        name: "storyIdeaSubmitOnEnter",
        addProseMirrorPlugins() {
          return [
            new Plugin({
              key: new PluginKey("storyIdeaSubmitOnEnter"),
              props: {
                // handleKeyDown(_view, event) {
                //   if (event.key === "Enter" && !event.shiftKey) {
                //     const submit = onSubmitRef.current
                //     if (submit) {
                //       event.preventDefault()
                //       submit()
                //       return true
                //     }
                //   }
                //   return false
                // },
              },
            }),
          ]
        },
      }),
    [],
  )

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: false,
      }),
      Placeholder.configure({
        placeholder,
      }),
      StoryIdeaLink,
      Markdown.configure({
        markedOptions: {
          gfm: true,
        },
      }),
      submitOnEnter,
    ],
    content: "",
    contentType: "markdown",
    editorProps: {
      attributes: {
        class:
          "story-idea-tiptap min-h-[60px] w-full outline-none text-base leading-7 text-foreground",
      },
    },
    onUpdate: ({ editor: updatedEditor }) => {
      onChange(updatedEditor.getMarkdown())
    },
  })

  useEffect(() => {
    if (!editor) return
    ref?.(editor)
    const placeholderExtension = editor.extensionManager.extensions.find(
      (extension) => extension.name === "placeholder",
    )
    if (placeholderExtension) {
      placeholderExtension.options.placeholder = placeholder
      editor.view.dispatch(editor.state.tr)
    }
  }, [editor, placeholder])

  return (
    <EditorContent
      editor={editor}
      className={cn(
        "min-w-0 w-full flex-1 pt-0.5 text-base",
        "[&_.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 [&_.is-editor-empty:first-child::before]:text-base [&_.is-editor-empty:first-child::before]:text-muted-foreground [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
        "[&_.ProseMirror]:outline-none [&_.ProseMirror_p]:my-0",
        "[&_.ProseMirror_h1]:my-1 [&_.ProseMirror_h1]:text-xl [&_.ProseMirror_h1]:font-semibold",
        "[&_.ProseMirror_h2]:my-1 [&_.ProseMirror_h2]:text-lg [&_.ProseMirror_h2]:font-semibold",
        "[&_.ProseMirror_h3]:my-1 [&_.ProseMirror_h3]:text-base [&_.ProseMirror_h3]:font-semibold",
        "[&_.ProseMirror_ul]:my-1 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-5",
        "[&_.ProseMirror_ol]:my-1 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-5",
        "[&_.ProseMirror_blockquote]:my-1 [&_.ProseMirror_blockquote]:border-l-2 [&_.ProseMirror_blockquote]:border-white/20 [&_.ProseMirror_blockquote]:pl-3",
        "[&_.ProseMirror_a]:text-primary [&_.ProseMirror_a]:underline",
        className,
      )}
    />
  )
}
