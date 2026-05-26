import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { Image } from '@tiptap/extension-image'
import { TableKit } from '@tiptap/extension-table'
import {
  Details,
  DetailsContent,
  DetailsSummary,
} from '@tiptap/extension-details'
import { Markdown } from '@tiptap/markdown'
import { useParams } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useDiffSave } from '../../hooks/use-autosave'
import TextEditorBubbleMenu from '../text-editor-extensions/bubble-menu'
import { useEditorInputBridge } from '../../bridge/use-editor-input-bridge'
import { serializeMarkdownWithTextAlign } from '../../extensions/markdown-text-align'
import {
  PatchAdditionMark,
  PatchDeletionMark,
} from '../../extensions/patch-diff'
import {
  FileMention,
  createFileMentionSuggestion,
  preprocessFileMentions,
} from '../../extensions/file-mention'
import { ImageLayout } from '../../extensions/image-layout'
import TextEditorToolbar from './text-editor-toolbar'
import type { EditorTab } from '../../types'
import { useFileMentionSearch } from '@/hooks/use-file-mention-search'
import './text-editor.css'

const SAMPLE_CONTENT = `
# Welcome to the Markdown Demo

This demo showcases **bidirectional** markdown support in Tiptap with extended features.

## Features

- **Bold text** and *italic text*
- \`inline code\` and code blocks
- [Links](https://tiptap.dev)
- Lists and more!

## Extended Features

## Images

![Minimal workspace](https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=900&auto=format&fit=crop&q=80 "Tiptap Editor")


## Task Lists

- [ ] Incomplete task
  - [ ] Nested incomplete task
  - [x] Completed task
- [x] Completed task
  - [ ] Incomplete task
  - [x] Completed task

End

## Table

|Scene| Status |
| --- | --- |
| Opening | Draft |
| Ending | Outline |
`

const editorExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    trailingNode: false,
  }),
  Placeholder.configure({
    placeholder: 'Start writing...',
  }),
  Highlight,
  TaskList,
  TaskItem.configure({
    nested: true,
    a11y: {
      checkboxLabel: (_node, checked) =>
        checked ? 'Mark task as incomplete' : 'Mark task as complete',
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
  Details.configure({
    persist: true,
    openClassName: 'is-open',
  }),
  DetailsSummary,
  DetailsContent,
  TextAlign.configure({
    types: ['heading', 'paragraph'],
  }),
  PatchAdditionMark,
  PatchDeletionMark,
  ImageLayout,
]

interface TextEditorViewProps {
  tab: EditorTab
  initialContent?: string
  initialRevision: number
}

export function TextEditorView({
  tab,
  initialContent,
  initialRevision,
}: TextEditorViewProps) {
  const { projectId } = useParams({
    from: '/dashboard/projects/$projectId/editor',
  })
  const baseMarkdown = initialContent || SAMPLE_CONTENT
  const diffSave = useDiffSave({
    duration: 2000,
    projectId,
    fileId: tab.id,
  })

  const setEditor = useEditorInputBridge((state) => state.setEditor)
  const clearEditor = useEditorInputBridge((state) => state.clearEditor)

  const searchFiles = useFileMentionSearch(projectId)
  const fileMentionSuggestion = useMemo(
    () => createFileMentionSuggestion(searchFiles),
    [searchFiles],
  )

  const editor = useEditor({
    immediatelyRender: true,
    extensions: [
      ...editorExtensions,
      FileMention.configure({
        HTMLAttributes: {
          class: 'file-mention',
        },
        suggestion: fileMentionSuggestion,
      }),
      Markdown.configure({
        markedOptions: {
          gfm: true,
        },
      }),
    ],
    content: preprocessFileMentions(baseMarkdown),
    contentType: 'markdown',
    editorProps: {
      attributes: {
        class: 'tiptap-editor-content focus:outline-none',
      },
    },
    onUpdate: ({ editor: updatedEditor }) => {
      const markdown = serializeMarkdownWithTextAlign(updatedEditor.getJSON(), [
        ...editorExtensions,
        FileMention,
      ])
      diffSave({
        oldText: baseMarkdown,
        newText: markdown,
        baseRevision: initialRevision,
      })
      // console.log(markdown)
    },
    onCreate: ({ editor: createdEditor }) => {
      setEditor(createdEditor)
    },
    onDestroy: () => {
      clearEditor(editor)
    },
  })

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      {/* Toolbar */}
      <TextEditorToolbar editor={editor} tabId={tab.id} />

      {/* Editor content */}
      <div className="flex-1 overflow-auto overscroll-none">
        <div className="mx-auto max-w-3xl px-6 py-8 min-w-2xl">
          <EditorContent
            editor={editor}
            className="[&_.tiptap]:outline-none [&_.tiptap]:min-h-[400px]"
          />
          <TextEditorBubbleMenu
            editor={editor}
            file={{ id: tab.id, name: tab.name }}
          />
        </div>
      </div>
    </div>
  )
}
