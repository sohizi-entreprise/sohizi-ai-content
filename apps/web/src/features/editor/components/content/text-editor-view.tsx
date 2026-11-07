import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import TextAlign from "@tiptap/extension-text-align"
import { TaskItem, TaskList } from "@tiptap/extension-list"
import { Image } from "@tiptap/extension-image"
import { TableKit } from "@tiptap/extension-table"
import { CharacterCount } from "@tiptap/extension-character-count"
import { Markdown } from "@tiptap/markdown"
import { useParams } from "@tanstack/react-router"
import { useMemo, useRef, useState } from "react"
import { useAutoSave } from "../../hooks/use-autosave"
import { usePendingMarkdownChanges } from "../../hooks/use-pending-markdown-changes"
import TextEditorBubbleMenu from "../text-editor-extensions/bubble-menu"
import { useEditorInputBridge } from "../../bridge/use-editor-input-bridge"
import {
  FileLinkSuggestion,
  createFileLinkSuggestion,
} from "../../extensions/file-link-suggestion"
import { uiBlockExtensions } from "../../extensions/ui-blocks"
import { MAX_CHARACTER_COUNT } from "../../constants"
import { MarkdownHighlight } from "../../extensions/markdown-highlight"
import { SlashCommandExtension } from "../../extensions/slash-command"
import { EditorLink } from "../../extensions/editor-link"
import { EditorTopChrome } from "./editor-top-chrome"
import { MarkdownDiffChangesPanel } from "./markdown-diff-changes-panel"
import { MarkdownPendingChangesBar } from "./markdown-pending-changes-bar"
import "./text-editor.css"
import type { Editor, JSONContent } from "@tiptap/react"
import type { EditorTab } from "../../types"
import { useFileMentionSearch } from "@/hooks/use-file-mention-search"

const editorExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: false,
  }),
  Placeholder.configure({
    showOnlyCurrent: true,
    includeChildren: false,
    emptyNodeClass: ({ hasAnchor }) => (hasAnchor ? "is-empty" : ""),
    placeholder: ({ node, hasAnchor }) => {
      if (!hasAnchor || node.type.name !== "paragraph") return ""
      return "Write something or use / command"
    },
  }),
  TaskList,
  TaskItem.configure({
    nested: true,
    a11y: {
      checkboxLabel: (_node, checked) =>
        checked ? "Mark task as incomplete" : "Mark task as complete",
    },
  }),
  Image.configure({
    allowBase64: true,
    inline: false,
    resize: {
      enabled: true,
      minWidth: 120,
      minHeight: 80,
      alwaysPreserveAspectRatio: true,
    },
  }),
  TableKit.configure({
    table: {
      resizable: true,
      renderWrapper: true,
      lastColumnResizable: false,
    },
  }),
  TextAlign.configure({
    types: ["heading", "paragraph"],
  }),
  ...uiBlockExtensions,
  EditorLink,
  CharacterCount.configure({
    limit: MAX_CHARACTER_COUNT,
  }),
  MarkdownHighlight,
  SlashCommandExtension,
]

interface TextEditorViewProps {
  tab: EditorTab
  initialContent?: string
  initialRevision: number
}

export function TextEditorView({ tab, initialContent }: TextEditorViewProps) {
  const { projectId } = useParams({
    from: "/_authenticated/projects/$projectId/editor",
  })
  const baseMarkdown = initialContent || ""
  const initialEditorContent = useMemo(
    () => toEditorContent(baseMarkdown),
    [baseMarkdown],
  )

  const [scrollContainer, setScrollContainer] = useState<HTMLElement | null>(
    null,
  )
  const appliedDiffRef = useRef(false)
  const isApplyingVisualDiffRef = useRef(false)

  const autosave = useAutoSave({
    duration: 2000,
    projectId,
    fileId: tab.id,
    onSaveComplete: () => {
      appliedDiffRef.current = false
    },
  })

  const setEditor = useEditorInputBridge((state) => state.setEditor)
  const clearEditor = useEditorInputBridge((state) => state.clearEditor)

  const searchFiles = useFileMentionSearch(projectId)

  const fileLinkSuggestion = useMemo(
    () => createFileLinkSuggestion(searchFiles),
    [searchFiles],
  )

  const editor = useEditor({
    immediatelyRender: true,
    extensions: [
      ...editorExtensions,
      FileLinkSuggestion.configure({
        suggestion: fileLinkSuggestion,
      }),
      Markdown.configure({
        markedOptions: {
          gfm: true,
        },
      }),
    ],
    content: initialEditorContent.content,
    contentType: initialEditorContent.contentType,
    editorProps: {
      attributes: {
        class: "tiptap-editor-content focus:outline-none",
      },
    },
    onUpdate: ({ editor: updatedEditor }) => {
      if (isApplyingVisualDiffRef.current) return
      autosave({
        content: updatedEditor.getMarkdown(),
        diffApplied: appliedDiffRef.current,
      })
    },
    onCreate: ({ editor: createdEditor }) => {
      setEditor(createdEditor)
    },
    onDestroy: () => {
      clearEditor(editor)
    },
  })

  const {
    pendingOperation,
    pendingPatch,
    changeHunks,
    changesOpen,
    setChangesOpen,
    handleAcceptChanges,
    handleRejectChanges,
  } = usePendingMarkdownChanges({
    editor,
    projectId,
    fileId: tab.id,
    baseMarkdown,
    autosave,
    setMarkdownContent: setEditorMarkdownContent,
    appliedDiffRef,
    isApplyingVisualDiffRef,
  })

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      <EditorTopChrome editor={editor} tabId={tab.id} />

      <div
        ref={setScrollContainer}
        className="flex-1 overflow-auto overscroll-none"
      >
        <div className="mx-auto min-w-2xl max-w-3xl px-6 pb-8 pt-12">
          <EditorContent
            editor={editor}
            className="[&_.tiptap]:outline-none [&_.tiptap]:min-h-100"
          />
          <TextEditorBubbleMenu
            editor={editor}
            scrollContainer={scrollContainer}
            file={{
              id: tab.id,
              name: tab.name,
              format: tab.type ?? tab.format ?? "markdown",
              path: tab.path,
            }}
          />
          {pendingOperation && (
            <MarkdownPendingChangesBar
              changesOpen={changesOpen}
              onToggleChanges={() => setChangesOpen((open) => !open)}
              onAccept={handleAcceptChanges}
              onReject={handleRejectChanges}
            />
          )}
        </div>
      </div>
      <MarkdownDiffChangesPanel
        open={Boolean(pendingPatch) && changesOpen}
        onOpenChange={setChangesOpen}
        hunks={changeHunks}
      />
    </div>
  )
}

const EMPTY_EDITOR_DOC: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
}

/**
 * TipTap's markdown parser turns empty/whitespace input into `{ type: 'doc' }`
 * with no blocks. ProseMirror then draws a horizontal caret until Enter creates
 * a paragraph. Always seed at least one empty paragraph instead.
 */
function toEditorContent(markdown: string): {
  content: string | JSONContent
  contentType?: "markdown"
} {
  const sliced = markdown.slice(0, MAX_CHARACTER_COUNT)
  if (!sliced.trim()) {
    return { content: EMPTY_EDITOR_DOC }
  }

  return {
    content: sliced,
    contentType: "markdown",
  }
}

function setEditorMarkdownContent(editor: Editor, markdown: string) {
  const next = toEditorContent(markdown)
  editor.commands.setContent(
    next.content,
    next.contentType ? { contentType: next.contentType } : undefined,
  )
}
