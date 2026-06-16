import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { Image } from '@tiptap/extension-image'
import { TableKit } from '@tiptap/extension-table'
import { CharacterCount } from '@tiptap/extension-character-count'
import { Markdown } from '@tiptap/markdown'
import { useParams } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useAutoSave } from '../../hooks/use-autosave'
import TextEditorBubbleMenu from '../text-editor-extensions/bubble-menu'
import { useEditorInputBridge } from '../../bridge/use-editor-input-bridge'
import {
  FileMention,
  createFileMentionSuggestion,
  preprocessFileMentions,
} from '../../extensions/file-mention'
import { ImageLayout } from '../../extensions/image-layout'
import TextEditorToolbar from './text-editor-toolbar'
import type { EditorTab, PendingFileOperation } from '../../types'
import { useFileMentionSearch } from '@/hooks/use-file-mention-search'
import { MAX_CHARACTER_COUNT } from '../../constants'
import './text-editor.css'
import {
  deletePendingOperationMutationOptions,
  getPendingOperationQueryOptions,
  saveFileContentMutationOptions,
} from '../../query-mutations'
import { useQuery } from '@tanstack/react-query'
import { acceptDiffMarkdown, rejectDiffMarkdown } from '../../diff-markdown'
import { MarkdownDiffExtensions } from '../../extensions/markdown-diff'
import { MarkdownHighlight } from '../../extensions/markdown-highlight'
import { diffWords } from 'diff'
import { toast } from 'sonner'
import { SlashCommandExtension } from '../../extensions/slash-command'
import { YoutubeEmbed } from '../../extensions/youtube-embed'
import { EditorLink } from '../../extensions/editor-link'


const editorExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    trailingNode: false,
    link: false,
  }),
  Placeholder.configure({
    placeholder: ({ node }) => {
      if (node.type.name === 'paragraph') {
        return 'Write something or use / command'
      }
      return ''
    },
    showOnlyCurrent: true,
    includeChildren: true,
  }),
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
  TextAlign.configure({
    types: ['heading', 'paragraph'],
  }),
  ImageLayout,
  EditorLink,
  YoutubeEmbed,
  CharacterCount.configure({
    limit: MAX_CHARACTER_COUNT,
  }),
  ...MarkdownDiffExtensions,
  MarkdownHighlight,
  SlashCommandExtension
]

interface TextEditorViewProps {
  tab: EditorTab
  initialContent?: string
  initialRevision: number
}

export function TextEditorView({
  tab,
  initialContent,
}: TextEditorViewProps) {
  const { projectId } = useParams({
    from: '/dashboard/projects/$projectId/editor',
  })
  const baseMarkdown = initialContent || ''

  const [scrollContainer, setScrollContainer] = useState<HTMLElement | null>(null)
  const appliedDiffRef = useRef(false)
  const visualizedPendingKeyRef = useRef<string | null>(null)
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

  // Get the pending operations so we can apply the diffs
  const { data, isLoading: isLoadingPendingOperation } = useQuery(getPendingOperationQueryOptions(projectId, tab.id))
  const pendingOperation = data?.operation ?? null

  const { mutateAsync: saveFileContent } = useMutation(
    saveFileContentMutationOptions(projectId, tab.id),
  )
  const { mutateAsync: deletePendingOperation } = useMutation(
    deletePendingOperationMutationOptions(projectId, tab.id),
  )


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
    content: preprocessFileMentions(baseMarkdown.slice(0, MAX_CHARACTER_COUNT)),
    contentType: 'markdown',
    editorProps: {
      attributes: {
        class: 'tiptap-editor-content focus:outline-none',
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


  useEffect(() => {
    if (!pendingOperation) {
      visualizedPendingKeyRef.current = null
      appliedDiffRef.current = false
    }
  }, [pendingOperation])

  useEffect(() => {
    if (!pendingOperation || !editor || isLoadingPendingOperation) return
    if (pendingOperation.diffApplied) return

    const payload = pendingOperation.payload
    if (payload?.type !== 'patch') return

    const pendingKey = getPendingOperationKey(pendingOperation)
    if (visualizedPendingKeyRef.current === pendingKey) return

    visualizedPendingKeyRef.current = pendingKey
    isApplyingVisualDiffRef.current = true

    const markdownDiff = buildDiff(baseMarkdown, payload.content)
    editor.commands.setContent(markdownDiff, { contentType: 'markdown' })
    appliedDiffRef.current = true
    isApplyingVisualDiffRef.current = false

    autosave({
      content: editor.getMarkdown(),
      diffApplied: true,
    })
  }, [pendingOperation, editor, isLoadingPendingOperation, baseMarkdown, autosave])

  const resolvePendingChanges = useCallback(
    async (content: string) => {
      if (!editor || !pendingOperation) return

      isApplyingVisualDiffRef.current = true
      editor.commands.setContent(content, { contentType: 'markdown' })
      appliedDiffRef.current = false
      visualizedPendingKeyRef.current = null
      isApplyingVisualDiffRef.current = false

      try {
        await saveFileContent({ content })
        await deletePendingOperation()

      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to save changes')
        console.error(error)
      }

    },
    [editor, pendingOperation, saveFileContent, deletePendingOperation],
  )

  const handleAcceptChanges = useCallback(() => {
    if (!editor) return
    void resolvePendingChanges(acceptDiffMarkdown(editor.getMarkdown()))
  }, [editor, resolvePendingChanges])

  const handleRejectChanges = useCallback(() => {
    if (!editor) return
    void resolvePendingChanges(rejectDiffMarkdown(editor.getMarkdown()))
  }, [editor, resolvePendingChanges])

  return (
    <div className="flex h-full w-full flex-col overflow-hidden relative">
      {/* Toolbar */}
      <div className='h-2 absolute top-14 left-1/2 -translate-x-1/2 z-10 w-[calc(100%-8rem)] max-w-[calc(var(--container-3xl)-4rem)] bg-linear-to-t dark:from-white/45 from-black/30 to-transparent'/>
      <TextEditorToolbar editor={editor} 
                         tabId={tab.id} 
                         className="absolute top-8 left-1/2 -translate-x-1/2 z-10 w-[calc(100%-4rem)] max-w-3xl"
      />

      {/* Editor content */}
      <div ref={setScrollContainer} className="flex-1 overflow-auto overscroll-none scrollbar-hide">
        <div className="mx-auto max-w-3xl px-6 pb-8 pt-32 min-w-2xl">
          <EditorContent
            editor={editor}
            className="[&_.tiptap]:outline-none [&_.tiptap]:min-h-[400px]"
          />
          <TextEditorBubbleMenu
            editor={editor}
            scrollContainer={scrollContainer}
            file={{ id: tab.id, name: tab.name }}
          />
          {
            pendingOperation && 
            (
              <div className="mt-4 border border-gray-200 bg-black/50 rounded-xl p-2 flex items-center justify-between backdrop-blur-sm absolute bottom-8 left-1/2 -translate-x-1/2 z-10 w-100">
                <h3 className="text-sm font-medium">Pending Operations</h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="bg-blue-500 text-white py-2 px-4 rounded-md text-sm"
                    onClick={handleAcceptChanges}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="bg-red-500 text-white py-2 px-4 rounded-md text-sm"
                    onClick={handleRejectChanges}
                  >
                    Reject
                  </button>
                </div>
              </div>
            )
          }
        </div>
      </div>
    </div>
  )
}

function getPendingOperationKey(operation: PendingFileOperation) {
  return `${operation.fileNodeId}:${operation.updatedAt}`
}

function buildDiff(text1: string, text2: string) {
  const base = acceptDiffMarkdown(text1)
  const next = acceptDiffMarkdown(text2)
  const wordsDiff = diffWords(base, next)

  return wordsDiff
    .map((item) => {
      if (!item.added && !item.removed) {
        return item.value;
      }

      const marker = item.added ? '+' : '-';
      const openMarker = item.added ? '{' : '[';
      const closeMarker = item.added ? '}' : ']';

      return item.value
        .split(/(\n+)/)
        .map((part) => {
          // Newline chunks stay outside markers
          if (/^\n+$/.test(part)) return part;

          // Trim leading/trailing spaces, keep them outside markers
          const leading = part.match(/^ */)?.[0] ?? '';
          const trailing = part.match(/ *$/)?.[0] ?? '';
          const inner = part.slice(leading.length, part.length - trailing.length);

          if (!inner) return part;

          return `${leading}${openMarker}${marker}${inner}${marker}${closeMarker}${trailing}`;
        })
        .join('');
    })
    .join('');
}
