import { useEditor, EditorContent, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import { TextSelection } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
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
} from '@/features/text-editor/extensions'
import { AIAdditionMark, AIDeletionMark } from '@/features/text-editor/extensions/ai-diff'
import { SceneExtension } from '@/features/text-editor/extensions/scene'
import { SceneDelimiterExtension } from '@/features/text-editor/extensions/scene-delimiter'
import { SlashCommandExtension } from '@/features/text-editor/extensions/slash-command'
import '@/features/text-editor/styles/editor.css'

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

type InsertableBlockType =
  | 'slugline'
  | 'action'
  | 'character'
  | 'dialogue'
  | 'parenthetical'
  | 'transition'
  | 'shot'
  | 'note'

export function ScenesEditor({
  content,
  onChange,
  onSelectionChange,
  readOnly = false,
  className = '',
}: ScenesEditorProps) {
  const insertBlockBelow = (
    view: EditorView,
    blockType: InsertableBlockType
  ) => {
    const { state } = view
    const { $from } = state.selection
    const currentBlock = $from.parent
    const currentBlockPos = $from.before($from.depth)

    let sceneDepth: number | null = null

    for (let depth = $from.depth; depth >= 0; depth--) {
      if ($from.node(depth).type.name === 'scene') {
        sceneDepth = depth
        break
      }
    }

    if (sceneDepth === null) {
      return false
    }

    const sceneNode = $from.node(sceneDepth)
    const scenePos = $from.before(sceneDepth)
    const sceneContentStart = scenePos + 1
    const sceneEndPos = scenePos + sceneNode.nodeSize - 1

    let existingTransitionPos: number | null = null

    sceneNode.forEach((child, offset) => {
      if (child.type.name === 'transition') {
        existingTransitionPos = sceneContentStart + offset
      }
    })

    if (blockType === 'slugline') {
      const insertPos = scenePos + sceneNode.nodeSize
      const tr = state.tr.insert(insertPos, [
        state.schema.nodes.sceneDelimiter.create(),
        state.schema.nodes.scene.create(
          { id: uuid() },
          [state.schema.nodes.slugline.create()],
        ),
      ])

      tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 2)))
      view.dispatch(tr)
      return true
    }

    if (blockType === 'transition' && existingTransitionPos !== null) {
      const tr = state.tr.setSelection(
        TextSelection.near(state.tr.doc.resolve(existingTransitionPos + 1)),
      )
      view.dispatch(tr)
      return true
    }

    let insertPos = currentBlockPos + currentBlock.nodeSize

    if (blockType === 'transition') {
      insertPos = sceneEndPos
    } else if (existingTransitionPos !== null && insertPos > existingTransitionPos) {
      insertPos = existingTransitionPos
    }

    let node = state.schema.nodes[blockType].create()
    let selectionPos = insertPos + 1

    if (blockType === 'character') {
      node = state.schema.nodes.character.create(
        undefined,
        state.schema.text('@'),
      )
      selectionPos = insertPos + 2
    }

    if (blockType === 'parenthetical') {
      node = state.schema.nodes.parenthetical.create(
        undefined,
        state.schema.text('()'),
      )
      selectionPos = insertPos + 2
    }

    const tr = state.tr.insert(insertPos, node)
    tr.setSelection(TextSelection.near(tr.doc.resolve(selectionPos)))
    view.dispatch(tr)

    return true
  }

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
            case 'dialogue':
              return 'Dialogue...'
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
      handleKeyDown: (view, event) => {
        const isShortcut = event.metaKey || event.ctrlKey

        if (isShortcut && !event.shiftKey && !event.altKey) {
          if (event.key === '1') return insertBlockBelow(view, 'slugline')
          if (event.key === '2') return insertBlockBelow(view, 'action')
          if (event.key === '3') return insertBlockBelow(view, 'character')
          if (event.key === '4') return insertBlockBelow(view, 'parenthetical')
          if (event.key === '5') return insertBlockBelow(view, 'dialogue')
          if (event.key === '6') return insertBlockBelow(view, 'transition')
          if (event.key === '7') return insertBlockBelow(view, 'shot')
          if (event.key === '8') return insertBlockBelow(view, 'note')
        }

        if (event.key === 'Enter' && !event.shiftKey) {
          const { state } = view
          const { $from } = state.selection
          const parent = $from.parent
          const parentType = parent.type.name

          // Only treat "/" as an active slash query when it looks like an actual command trigger.
          const textContent = parent.textContent
          const cursorOffset = $from.parentOffset
          const textBeforeCursor = textContent.slice(0, cursorOffset)
          const hasActiveSlashQuery = /(?:^|\s)\/[^\s/]*$/.test(textBeforeCursor)

          if (hasActiveSlashQuery) {
            return false // Let slash command handle it
          }

          // Rule 1: Slugline + Enter → Action block
          if (parentType === 'slugline') {
            const sceneNode = $from.node($from.depth - 1)
            if (sceneNode && sceneNode.type.name === 'scene') {
              const endOfBlock = $from.end()

              const tr = state.tr.insert(
                endOfBlock + 1,
                state.schema.nodes.action.create()
              )
              const nextPos = endOfBlock + 2

              tr.setSelection(TextSelection.near(tr.doc.resolve(nextPos)))
              view.dispatch(tr)

              return true
            }
          }

          // Rule 2: Character + Enter → Dialogue block
          // (Already handled by CharacterExtension's keyboard shortcuts)
          if (parentType === 'character') {
            return false // Let the extension handle it
          }

          // Rule 3: Any other block + Enter → Insert "/" to trigger slash command
          if (['action', 'dialogue', 'parenthetical', 'transition', 'shot', 'note'].includes(parentType)) {
            const endOfBlock = $from.end()

            // Insert a fresh action block and seed it with "/" in one transaction
            // so the slash-command plugin can replace that query cleanly.
            const tr = state.tr.insert(
              endOfBlock + 1,
              state.schema.nodes.action.create()
            )
            const nextPos = endOfBlock + 2

            tr.setSelection(TextSelection.near(tr.doc.resolve(nextPos)))
            tr.insertText('/', tr.selection.from, tr.selection.to)
            view.dispatch(tr)

            return true
          }
        }
        return false
      },
    },
  })

  if (!editor) {
    return null
  }

  return (
    <div className={`scenes-editor ${className}`}>
      <div className="scenes-editor-wrapper">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
