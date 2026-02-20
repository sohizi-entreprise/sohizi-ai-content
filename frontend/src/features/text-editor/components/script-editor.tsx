import { useEditor, EditorContent, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import { useEditorStore } from '../store/editor-store'
import { EditorToolbar } from './editor-toolbar'
import { 
  SceneHeadingExtension,
  ActionExtension,
  CharacterExtension,
  DialogueExtension,
  ParentheticalExtension,
  TransitionExtension,
  ShotExtension,
  NoteExtension,
  PageBreakExtension,
} from '../extensions'
import { AIAdditionMark, AIDeletionMark } from '../extensions/ai-diff'
import { SlashCommandExtension } from '../extensions/slash-command'
import '../styles/editor.css'
import ActionsBubbleMenu from './bubble-menu'
import { peopleMentionSuggestion, tagMentionSuggestion } from './render-mentions'
import Mention from '@tiptap/extension-mention'
import { 
  PaginationPlus,
  PAGE_SIZES
} from 'tiptap-pagination-plus'

// Configuration for mention prefixes
const MENTION_CONFIG = {
  people: {
    showPrefix: false,  // Set to false to hide "@" prefix
    char: '@',
  },
  tag: {
    showPrefix: false,  // Set to false to hide "#" prefix
    char: '#',
  },
}

// Create separate mention extensions for different trigger characters
const PeopleMention = Mention.extend({
  name: 'peopleMention',
}).configure({
  HTMLAttributes: {
    class: 'mention mention-people',
  },
  suggestion: peopleMentionSuggestion,
  renderLabel: ({ node }) => {
    const prefix = MENTION_CONFIG.people.showPrefix ? MENTION_CONFIG.people.char : ''
    return `${prefix}${node.attrs.label ?? node.attrs.id}`
  },
})

const TagMention = Mention.extend({
  name: 'tagMention',
}).configure({
  HTMLAttributes: {
    class: 'mention mention-tag',
  },
  suggestion: tagMentionSuggestion,
  renderLabel: ({ node }) => {
    const prefix = MENTION_CONFIG.tag.showPrefix ? MENTION_CONFIG.tag.char : ''
    return `${prefix}${node.attrs.label ?? node.attrs.id}`
  },
})


export type { JSONContent }

type ScriptEditorProps = {
  content?: JSONContent | null
  onChange?: (content: JSONContent) => void
  onSelectionChange?: (selection: { from: number; to: number; text: string } | null) => void
  readOnly?: boolean
  className?: string
}

// Default empty document structure
const DEFAULT_CONTENT: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
    }
  ]
}

export function ScriptEditor({
  content,
  onChange,
  onSelectionChange,
  readOnly = false,
  className = '',
}: ScriptEditorProps) {
  const { 
    mode, 
    setSelection,
    setActiveBlockId,
  } = useEditorStore()

  const editor = useEditor({
    immediatelyRender: false, // Disable SSR to avoid hydration mismatches
    extensions: [
      StarterKit.configure({
        // Disable default nodes we're replacing
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      PaginationPlus.configure({
        ...PAGE_SIZES.A4,
        pageGap: 50,            // Gap between pages in pixels
        pageGapBorderSize: 1,   // Border size for page gaps
        pageGapBorderColor: "#e5e5e5", // Border color for page gaps
        pageBreakBackground: "#ffffff",  // Background color for page gaps
        footerRight: "",  // Custom HTML content to display in the footer right side
        headerRight: "{page}",        // Custom HTML content to display in the header right side
        contentMarginTop: 40,   // Top margin for content within pages
        contentMarginBottom: 10, // Bottom margin for content within pages
      }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === 'sceneHeading') {
            return 'INT./EXT. LOCATION - TIME'
          }
          if (node.type.name === 'character') {
            return 'CHARACTER NAME'
          }
          if (node.type.name === 'dialogue') {
            return 'Dialogue...'
          }
          if (node.type.name === 'action') {
            return 'Describe the action...'
          }
          return 'Type / for commands...'
        },
      }),
      Highlight.configure({
        multicolor: true,
      }),
      // Custom screenplay extensions
      SceneHeadingExtension,
      ActionExtension,
      CharacterExtension,
      DialogueExtension,
      ParentheticalExtension,
      TransitionExtension,
      ShotExtension,
      NoteExtension,
      PageBreakExtension,
      // AI Diff marks (for [[deleted]] and {{added}} content)
      AIAdditionMark,
      AIDeletionMark,
      // Slash command extension (/ menu)
      SlashCommandExtension,
      // Mention extensions (separate for different styles)
      PeopleMention,
      TagMention,
    ],
    content: content || DEFAULT_CONTENT,
    editable: !readOnly && mode !== 'readonly',
    onUpdate: ({ editor }) => {
      onChange?.(editor.getJSON())
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection
      const text = editor.state.doc.textBetween(from, to, ' ')
      
      if (from !== to) {
        setSelection({
          blocks: [],
          text,
          range: { from, to },
        })
        onSelectionChange?.({ from, to, text })
      } else {
        setSelection(null)
        onSelectionChange?.(null)
      }

      // Track active block
      const $pos = editor.state.doc.resolve(from)
      const node = $pos.node()
      if (node.attrs?.id) {
        setActiveBlockId(node.attrs.id)
      }
    },
    editorProps: {
      attributes: {
        class: 'script-editor-content',
      },
    },
  })

  // Keyboard shortcuts for block types are handled by extensions

  if (!editor) {
    return null
  }

  return (
    <div className={`script-editor ${className}`}>
      <EditorToolbar editor={editor} />
      
      <div className="script-editor-wrapper">
        <EditorContent editor={editor} />
      </div>

      <ActionsBubbleMenu editor={editor} />
    </div>
  )
}
