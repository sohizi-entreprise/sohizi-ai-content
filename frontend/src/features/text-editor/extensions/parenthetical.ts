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
        ({ chain, state }) => {
          // Set the node, insert "()", then move cursor between the parentheses
          return chain()
            .setNode(this.name)
            .command(({ tr, dispatch }) => {
              if (dispatch) {
                const { from } = tr.selection
                // Insert "()" at cursor position
                tr.insertText('()', from)
                // Move cursor between the parentheses (after the opening paren)
                tr.setSelection(
                  state.selection.constructor.near(tr.doc.resolve(from + 1))
                )
              }
              return true
            })
            .run()
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
