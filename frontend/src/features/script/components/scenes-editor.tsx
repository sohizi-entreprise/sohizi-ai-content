import { useEditor, EditorContent, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import { v4 as uuid } from 'uuid'
import {
  SluglineExtension,
  ActionExtension,
  CharacterExtension,
  DialogueExtension,
  ParentheticalExtension,
  TransitionExtension,
  ShotExtension,
  NoteExtension,
  SpeechExtension,
} from '@/features/text-editor/extensions'
import { AIAdditionMark, AIDeletionMark } from '@/features/text-editor/extensions/ai-diff'
import { SceneExtension } from '@/features/text-editor/extensions/scene'
import { SceneDelimiterExtension } from '@/features/text-editor/extensions/scene-delimiter'
import { SlashCommandExtension } from '@/features/text-editor/extensions/slash-command'
import '@/features/text-editor/styles/editor.css'
import { cn } from '@/lib/utils'

export type { JSONContent }

type ScenesEditorProps = {
  content?: JSONContent | null
  onChange?: (content: JSONContent) => void
  onSelectionChange?: (selection: { from: number; to: number; text: string } | null) => void
  readOnly?: boolean
  className?: string
}

const DEFAULT_CONTENT: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'scene',
      attrs: { id: uuid() },
      content: [
        {
          type: 'slugline',
        },
      ],
    },
  ],
}


export function ScenesEditor({
  content,
  onChange,
  onSelectionChange,
  readOnly = false,
  className = '',
}: ScenesEditorProps) {

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        paragraph: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
      }),
      Placeholder.configure({
        includeChildren: true,
        showOnlyCurrent: false,
        emptyNodeClass: 'is-empty',
        placeholder: ({ node }) => {
          switch (node.type.name) {
            case 'slugline':
              return 'INT./EXT. LOCATION - TIME'
            case 'action':
              return 'Describe the action...'
            case 'character':
              return 'CHARACTER NAME'
            case 'parenthetical':
              return '(direction)'
            case 'transition':
              return 'CUT TO:'
            case 'shot':
              return 'ANGLE ON:'
            case 'note':
              return 'Writer\'s note...'
            default:
              return ''
          }
        },
      }),
      Highlight.configure({
        multicolor: true,
      }),
      SceneExtension,
      SceneDelimiterExtension,
      SluglineExtension,
      ActionExtension,
      CharacterExtension,
      DialogueExtension,
      ParentheticalExtension,
      TransitionExtension,
      ShotExtension,
      NoteExtension,
      AIAdditionMark,
      AIDeletionMark,
      SlashCommandExtension,
      SpeechExtension
    ],
    content: content || DEFAULT_CONTENT,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getJSON())
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection
      const text = editor.state.doc.textBetween(from, to, ' ')

      if (from !== to) {
        onSelectionChange?.({ from, to, text })
      } else {
        onSelectionChange?.(null)
      }
    },
    editorProps: {
      attributes: {
        class: 'scenes-editor-content',
      },
    },
  })

  if (!editor) {
    return null
  }

  return (
    <div className={cn("mx-auto container max-w-paper", className)}>
      <EditorContent editor={editor} />
    </div>
  )
}
