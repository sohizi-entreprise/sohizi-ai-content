import { Node, mergeAttributes } from '@tiptap/core'
import { v4 as uuid } from 'uuid'

export interface ParentheticalOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    parenthetical: {
      setParenthetical: () => ReturnType
      toggleParenthetical: () => ReturnType
    }
  }
}

export const ParentheticalExtension = Node.create<ParentheticalOptions>({
  name: 'parenthetical',

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  group: 'block',

  content: 'inline*',

  defining: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-id'),
        renderHTML: (attributes) => {
          if (!attributes.id) {
            return { 'data-id': uuid() }
          }
          return { 'data-id': attributes.id }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="parenthetical"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'parenthetical',
        class: 'screenplay-parenthetical',
      }),
      0,
    ]
  },

  addCommands() {
    return {
      setParenthetical:
        () =>
        ({ commands }) => {
          // Set the node, insert "()", then move cursor between the parentheses
          return commands.setNode(this.name)
        },
      toggleParenthetical:
        () =>
        ({ commands }) => {
          return commands.toggleNode(this.name, 'paragraph')
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-4': () => this.editor.commands.setParenthetical(),
      'Enter': ({ editor }) => {
        const { state } = editor
        const { $from } = state.selection

        if ($from.parent.type.name !== 'parenthetical') {
          return false
        }

        const text = $from.parent.textContent.trim()
        const insertPos = $from.after($from.depth)
        const dialogueNode = $from.node($from.depth - 1)
        const dialogueContentStart = $from.before($from.depth - 1) + 1
        let speechPos: number | null = null

        if (dialogueNode?.type.name === 'dialogue') {
          dialogueNode.forEach((child, offset) => {
            if (child.type.name === 'speech' && speechPos === null) {
              speechPos = dialogueContentStart + offset
            }
          })
        }

        if (text.length === 0) {
          if (speechPos !== null) {
            return editor.chain().focus(speechPos + 1).run()
          }

          return editor.chain()
            .insertContentAt(insertPos, { type: 'speech' })
            .focus(insertPos + 1)
            .run()
        }

        if (speechPos !== null) {
          return editor.chain().focus(speechPos + 1).run()
        }

        return editor.chain()
          .insertContentAt(insertPos, { type: 'speech' })
          .focus(insertPos + 1)
          .run()
      },
      
      // Backspace: if trying to delete opening parenthesis, delete the block
      'Backspace': ({ editor }) => {
        const { state } = editor
        const { $from, empty } = state.selection
        
        // Only handle if cursor is in a parenthetical block
        if ($from.parent.type.name !== 'parenthetical') {
          return false
        }
        
        // If selection is not empty, let default behavior handle it
        if (!empty) {
          return false
        }
        
        const text = $from.parent.textContent
        const posInNode = $from.parentOffset
        
        // Check if the character before cursor is "("
        const charBeforeCursor = text.charAt(posInNode - 1)
        
        // If cursor is right after "(", delete the block
        if (charBeforeCursor === '(') {
          return editor.chain().deleteNode('parenthetical').run()
        }
        
        // Also delete if content is just "()"
        if (text === '()') {
          return editor.chain().deleteNode('parenthetical').run()
        }
        
        return false
      },
      
      // Delete: if trying to delete closing parenthesis, delete the block
      'Delete': ({ editor }) => {
        const { state } = editor
        const { $from, empty } = state.selection
        
        // Only handle if cursor is in a parenthetical block
        if ($from.parent.type.name !== 'parenthetical') {
          return false
        }
        
        // If selection is not empty, let default behavior handle it
        if (!empty) {
          return false
        }
        
        const text = $from.parent.textContent
        const posInNode = $from.parentOffset
        
        // Check if the character after cursor is ")"
        const charAfterCursor = text.charAt(posInNode)
        
        // If cursor is right before ")", delete the block
        if (charAfterCursor === ')') {
          return editor.chain().deleteNode('parenthetical').run()
        }
        
        // Also delete if content is just "()"
        if (text === '()') {
          return editor.chain().deleteNode('parenthetical').run()
        }
        
        return false
      },
    }
  },
})
