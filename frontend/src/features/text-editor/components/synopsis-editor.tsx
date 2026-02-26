import { useEditor, EditorContent, type JSONContent } from '@tiptap/react'
import { Node, Extension, mergeAttributes } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { AIAdditionMark, AIDeletionMark } from '../extensions/ai-diff'
import { useEffect, useRef } from 'react'
import '../styles/synopsis-editor.css'
import { Button } from '@/components/ui/button'
import { IconArrowNarrowRight, IconArrowBackUp, IconArrowForwardUp } from '@tabler/icons-react'
import type { Editor } from '@tiptap/react'
import { useChatStore } from '@/features/chat'

// ============================================================================
// CUSTOM EXTENSIONS
// ============================================================================

// Synopsis Title Node
const SynopsisTitleNode = Node.create({
  name: 'synopsisTitle',
  group: 'block',
  content: 'inline*',

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

// Custom keyboard shortcut extension for Cmd+K
const SelectionShortcut = Extension.create({
  name: 'selectionShortcut',

  addKeyboardShortcuts() {
    return {
      'Mod-k': ({ editor }) => {
        const { from, to } = editor.state.selection
        
        // If no selection (cursor is at a single point), do nothing
        if (from === to) {
          return false
        }
        
        // Get the selected text
        const selectedText = editor.state.doc.textBetween(from, to, ' ')
        
        // Access store directly and update state
        const { addSelectionContext, setInputFocused, setInputContent, inputContent } = useChatStore.getState()
        const blockId = crypto.randomUUID()
        const blockContent = selectedText.length > 24 ? selectedText.slice(0, 24) + '...' : selectedText
        addSelectionContext({ id: blockId, display: blockContent })
        setInputContent(inputContent + ` &&[${blockContent}](${blockId})`)
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

export type SynopsisData = {
  title: string
  text: string
}

type SynopsisEditorProps = {
  content?: SynopsisData | null
  onChange?: (content: SynopsisData) => void
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
  // Track the last content we set to avoid unnecessary updates
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
          if (node.type.name === 'synopsisContent') {
            return 'Enter your synopsis here...'
          }
          return ''
        },
      }),
      // Custom synopsis nodes
      SynopsisTitleNode,
      SynopsisDividerNode,
      SynopsisContentNode,
      // AI Diff marks
      AIAdditionMark,
      AIDeletionMark,
      // Custom keyboard shortcuts
      SelectionShortcut,
    ],
    content: synopsisToJSON(content),
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      const json = editor.getJSON()
      const synopsisData = jsonToSynopsis(json)
      // Update ref to track what we have in editor
      lastContentRef.current = JSON.stringify(synopsisData)
      onChange?.(synopsisData)
    },
    editorProps: {
      attributes: {
        class: 'synopsis-editor-content',
      },
    },
  })

  // Sync editor content when prop changes (e.g., from store updates)
  useEffect(() => {
    if (!editor || !content) return

    const contentKey = JSON.stringify(content)
    
    // Only update if content actually changed and differs from editor state
    if (contentKey !== lastContentRef.current) {
      lastContentRef.current = contentKey
      const newContent = synopsisToJSON(content)
      editor.commands.setContent(newContent)
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

// ============================================================================
// HELPERS
// ============================================================================

// Convert SynopsisData to TipTap JSONContent
function synopsisToJSON(data: SynopsisData | null | undefined): JSONContent {
    // Split text by double newlines to create paragraphs
    const paragraphs = data?.text 
      ? data.text.split('\n\n').filter(p => p.trim())
      : []
  
    const contentNodes: JSONContent[] = [
      {
        type: 'synopsisTitle',
        content: data?.title ? [{ type: 'text', text: data.title }] : [],
      },
      {
        type: 'synopsisDivider',
      },
    ]
  
    // Add each paragraph as a separate synopsisContent node
    if (paragraphs.length > 0) {
      for (const paragraph of paragraphs) {
        contentNodes.push({
          type: 'synopsisContent',
          content: [{ type: 'text', text: paragraph }],
        })
      }
    } else {
      // Add empty paragraph for placeholder
      contentNodes.push({
        type: 'synopsisContent',
        content: [],
      })
    }
  
    return {
      type: 'doc',
      content: contentNodes,
    }
  }
  
  // Extract SynopsisData from TipTap JSONContent
  function jsonToSynopsis(json: JSONContent): SynopsisData {
    let title = ''
    const paragraphs: string[] = []
  
    if (json.content) {
      for (const node of json.content) {
        if (node.type === 'synopsisTitle') {
          title = extractText(node)
        } else if (node.type === 'synopsisContent') {
          const paragraphText = extractText(node)
          if (paragraphText) {
            paragraphs.push(paragraphText)
          }
        }
      }
    }
  
    // Join paragraphs with double newlines
    const text = paragraphs.join('\n\n')
  
    return { title, text }
  }
  
  // Helper to extract text from a node
  function extractText(node: JSONContent): string {
    if (!node.content) return ''
    return node.content
      .map((child) => {
        if (child.type === 'text') return child.text || ''
        return extractText(child)
      })
      .join('')
  }
