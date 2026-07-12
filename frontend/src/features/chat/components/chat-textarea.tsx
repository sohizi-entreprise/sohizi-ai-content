import { createFileMentionSuggestion, FileMention } from "@/features/editor/extensions/file-mention";
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { useFileMentionSearch } from "@/hooks/use-file-mention-search";
import { cn } from "@/lib/utils";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Markdown } from "@tiptap/markdown";
import { Editor, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from '@tiptap/starter-kit'
import { ClassValue } from "clsx";
import { RefObject, useEffect, useMemo, useRef } from "react";


type ChatTextareaProps = {
    projectId: string
    onChange: (content: string) => void
    className?: ClassValue
    placeholder?: string
    editorRef?: RefObject<Editor | null>
    /** Called when the user presses Enter (without Shift). */
    onSubmit?: () => void
    /** Called whenever the underlying editor instance changes (ready/destroyed). */
    onEditorReady?: (editor: Editor | null) => void
}

export default function ChatTextarea(props: ChatTextareaProps) {

    const { projectId, onChange, className, placeholder, editorRef, onSubmit, onEditorReady } = props

    const searchFiles = useFileMentionSearch(projectId)

    const onSubmitRef = useRef(onSubmit)
    useEffect(() => {
        onSubmitRef.current = onSubmit
    }, [onSubmit])

    const fileMentionSuggestion = useMemo(
        () => createFileMentionSuggestion(searchFiles),
        [searchFiles],
    )

    // Registered as a ProseMirror plugin so it runs *after* the mention
    // suggestion plugin: when the @-mention popup is open it consumes Enter to
    // select an item, otherwise Enter submits the prompt.
    const submitOnEnter = useMemo(
        () =>
            Extension.create({
                name: 'chatSubmitOnEnter',
                addProseMirrorPlugins() {
                    return [
                        new Plugin({
                            key: new PluginKey('chatSubmitOnEnter'),
                            props: {
                                handleKeyDown(_view, event) {
                                    if (event.key === 'Enter' && !event.shiftKey) {
                                        const submit = onSubmitRef.current
                                        if (submit) {
                                            event.preventDefault()
                                            submit()
                                            return true
                                        }
                                    }
                                    return false
                                },
                            },
                        }),
                    ]
                },
            }),
        [],
    )

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                blockquote: false,
                bulletList: false,
                code: false,
                codeBlock: false,
                dropcursor: false,
                gapcursor: false,
                hardBreak: false,
                heading: false,
                horizontalRule: false,
                italic: false,
                listItem: false,
                orderedList: false,
                strike: false,
                bold: false,
            }),
            Placeholder.configure({
                placeholder: placeholder ?? 'Write your prompt ...',
            }),
            FileMention.configure({
                HTMLAttributes: {
                  class: 'inline-flex rounded bg-white/10 px-1 py-0 text-zinc-100 ring-1 ring-white/10',
                },
                enableClick: true,
                suggestion: fileMentionSuggestion,
              }),
            Markdown.configure({
                markedOptions: {
                    gfm: true,
                },
            }),
            submitOnEnter,
        ],
        content: '',
        contentType: 'markdown',
        editorProps: {
            attributes: {
            class:
                'media-chat-tiptap min-h-[54px] flex-1 outline-none text-sm leading-7 text-white',
            },
            handlePaste(view, event) {
            const text = event.clipboardData?.getData('text/plain')
            if (!text) return false

            event.preventDefault()
            view.dispatch(view.state.tr.insertText(text))
            return true
            },
        },
        onUpdate: ({ editor: updatedEditor }) => {
            onChange(updatedEditor.getMarkdown())
        },
    })

    useEffect(() => {
        onEditorReady?.(editor)
    }, [editor, onEditorReady])

    useEffect(() => {
        if (editorRef) {
            editorRef.current = editor
        }
    }, [editor, editorRef])

  return (
    <EditorContent
        editor={editor}
        className={cn(
        'min-w-0 pt-0.5',
        '[&_.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 [&_.is-editor-empty:first-child::before]:text-muted-foreground [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]',
        '[&_.ProseMirror_p]:my-0 [&_.ProseMirror]:outline-none',
        className,
        )}
    />
  )
}
