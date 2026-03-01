import { useEditor, EditorContent, type JSONContent } from '@tiptap/react'
import { Node, Extension, mergeAttributes } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { AIAdditionMark, AIDeletionMark, ContextAnchorMark } from '../extensions'
import { useEffect, useRef } from 'react'
import '../styles/synopsis-editor.css'
import { Button } from '@/components/ui/button'
import { IconArrowNarrowRight, IconArrowBackUp, IconArrowForwardUp } from '@tabler/icons-react'
import type { Editor } from '@tiptap/react'
import { useChatStore, useSelectionSync } from '@/features/chat'

// ============================================================================
// CUSTOM EXTENSIONS
// ============================================================================

// Synopsis Title Node
const SynopsisTitleNode = Node.create({
  name: 'synopsisTitle',
  group: 'block',
  content: 'inline*',

  addAttributes() {
    return {
      blockId: {
        default: null,
        parseHTML: element => element.getAttribute('data-block-id'),
        renderHTML: attributes => {
          if (!attributes.blockId) return {}
          return { 'data-block-id': attributes.blockId }
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'h1[data-type="synopsis-title"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['h1', mergeAttributes(HTMLAttributes, { 
      'data-type': 'synopsis-title',
      class: 'synopsis-title' 
    }), 0]
  },
})

// Synopsis Divider Node (non-editable)
const SynopsisDividerNode = Node.create({
  name: 'synopsisDivider',
  group: 'block',
  atom: true, // Makes it non-editable
  selectable: false,
  draggable: false,

  addAttributes() {
    return {
      blockId: {
        default: null,
        parseHTML: element => element.getAttribute('data-block-id'),
        renderHTML: attributes => {
          if (!attributes.blockId) return {}
          return { 'data-block-id': attributes.blockId }
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="synopsis-divider"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'synopsis-divider',
        class: 'synopsis-divider',
        contenteditable: 'false',
      }),
      ['div', { class: 'synopsis-divider-line' }],
      ['span', { class: 'synopsis-divider-text' }, 'Synopsis review'],
      ['div', { class: 'synopsis-divider-line' }],
    ]
  },
})

// Synopsis Content Node (paragraph for the main text)
const SynopsisContentNode = Node.create({
  name: 'synopsisContent',
  group: 'block',
  content: 'inline*',

  addAttributes() {
    return {
      blockId: {
        default: null,
        parseHTML: element => element.getAttribute('data-block-id'),
        renderHTML: attributes => {
          if (!attributes.blockId) return {}
          return { 'data-block-id': attributes.blockId }
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="synopsis-content"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 
      'data-type': 'synopsis-content',
      class: 'synopsis-content' 
    }), 0]
  },
})

// Synopsis Spacer Node (empty paragraph between content, no placeholder)
const SynopsisSpacerNode = Node.create({
  name: 'synopsisSpacer',
  group: 'block',
  content: 'inline*',

  parseHTML() {
    return [{ tag: 'div[data-type="synopsis-spacer"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 
      'data-type': 'synopsis-spacer',
      class: 'synopsis-spacer' 
    }), 0]
  },
})

// Custom keyboard shortcut extension for Cmd+K
// Applies a context anchor mark to the selection for AI reference
const SelectionShortcut = Extension.create({
  name: 'selectionShortcut',

  addKeyboardShortcuts() {
    return {
      'Mod-k': ({ editor }) => {
        const { from, to, $from } = editor.state.selection
        
        // If no selection (cursor is at a single point), do nothing
        if (from === to) {
          return false
        }
        
        // Get the selected text
        const selectedText = editor.state.doc.textBetween(from, to, ' ')
        
        // Get the parent block's blockId
        const parentNode = $from.parent
        const blockId = parentNode.attrs?.blockId as string | undefined
        
        // Generate a unique anchor ID
        const anchorId = crypto.randomUUID()
        
        // Apply the context anchor mark to wrap the selection
        editor.chain().setContextAnchor({ anchorId }).run()
        
        // Create display text (truncated if needed)
        const displayText = selectedText.length > 24 
          ? selectedText.slice(0, 24) + '...' 
          : selectedText
        
        // Update chat store with full context
        const { addSelectionContext, setInputFocused, setInputContent, inputContent } = useChatStore.getState()
        
        addSelectionContext({ 
          id: anchorId, 
          display: displayText,
          fullText: selectedText,
          from,
          to,
          blockId,
        })
        
        setInputContent(inputContent + ` &&[${displayText}](${anchorId})`)
        setInputFocused(true)
        
        return true
      },
    };
  },
});

// ============================================================================
// TYPES
// ============================================================================

export type { JSONContent }

type SynopsisEditorProps = {
  content?: JSONContent | null
  onChange?: (content: JSONContent) => void
  readOnly?: boolean
  className?: string
}


// ============================================================================
// COMPONENT
// ============================================================================

export function SynopsisEditor({
  content,
  onChange,
  readOnly = false,
  className = '',
}: SynopsisEditorProps) {
  // Track the last content to avoid unnecessary updates
  const lastContentRef = useRef<string>('')

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        // Disable features we don't need
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        code: false,
      }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === 'synopsisTitle') {
            return 'Title...'
          }
          return ''
        },
      }),
      // Custom synopsis nodes
      SynopsisTitleNode,
      SynopsisDividerNode,
      SynopsisContentNode,
      SynopsisSpacerNode,
      // AI Diff marks
      AIAdditionMark,
      AIDeletionMark,
      // Context anchor for AI editing
      ContextAnchorMark,
      // Custom keyboard shortcuts
      SelectionShortcut,
    ],
    content: content ?? undefined,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      const json = editor.getJSON()
      console.log(json)
      lastContentRef.current = JSON.stringify(json)
      onChange?.(json)
    },
    editorProps: {
      attributes: {
        class: 'synopsis-editor-content',
      },
    },
  })

  // Sync selection removal between chat input and editor
  // When a selection is removed from chat input, remove the context anchor mark
  useSelectionSync({ editor, enabled: !readOnly })

  // Sync editor content when content prop changes
  useEffect(() => {
    if (!editor) return

    // If content is null/undefined, clear the editor (e.g., when regenerating)
    if (!content) {
      lastContentRef.current = ''
      editor.commands.clearContent(false) // false = don't emit update
      return
    }

    const contentKey = JSON.stringify(content)
    
    // Only update if content actually changed
    if (contentKey !== lastContentRef.current) {
      lastContentRef.current = contentKey
      // Use emitUpdate: false to prevent triggering onUpdate during streaming
      // This avoids a feedback loop: setContent -> onUpdate -> setSynopsis -> re-render
      editor.commands.setContent(content, { emitUpdate: false })
    }
  }, [editor, content])

  // Update editable state when readOnly changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(!readOnly)
    }
  }, [editor, readOnly])

  if (!editor) {
    return null
  }

  return (
    <div className={`synopsis-editor ${className}`}>
      <div className="synopsis-editor-wrapper">
        <EditorContent editor={editor} />
      </div>
      <ActionButtons editor={editor} />
    </div>
  )
}


function ActionButtons({ editor }: { editor: Editor }) {
    const canUndo = editor.can().undo()
    const canRedo = editor.can().redo()

    return(
        <div className='flex items-center w-2xl gap-2 absolute bottom-4 left-1/2 -translate-x-1/2 p-2 rounded-xl bg-linear-to-t from-background to-background/80 backdrop-blur-md border border-gray-300/50 drop-shadow-md z-10'>
            <div className='flex items-center'>
                <Button 
                    variant='ghost' 
                    size='icon'
                    onClick={() => editor.chain().focus().undo().run()}
                    disabled={!canUndo}
                    className='size-9'
                >
                    <IconArrowBackUp className='size-4' />
                </Button>
                <Button 
                    variant='ghost' 
                    size='icon'
                    onClick={() => editor.chain().focus().redo().run()}
                    disabled={!canRedo}
                    className='size-9'
                >
                    <IconArrowForwardUp className='size-4' />
                </Button>
            </div>
            <div className='h-6 w-px bg-white/20'/>
            <Button className='font-bold capitalize shadow-md ml-auto'>
                Generate script
                <IconArrowNarrowRight className='size-4' />
            </Button>
        </div>
    )
}

