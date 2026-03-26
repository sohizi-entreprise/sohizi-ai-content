import { Node, mergeAttributes } from '@tiptap/core'
import { v4 as uuid } from 'uuid'

export interface ActionOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    action: {
      setAction: () => ReturnType
      toggleAction: () => ReturnType
    }
  }
}

export const ActionExtension = Node.create<ActionOptions>({
  name: 'action',

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
        tag: 'div[data-type="action"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'action',
        class: 'screenplay-action'
      }),
      0,
    ]
  },

  addCommands() {
    return {
      setAction:
        () =>
        ({ commands }) => {
          return commands.setNode(this.name)
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-2': () => this.editor.commands.setAction(),
      'Enter': ({editor}) => {
          const { $from } = editor.state.selection
          if ($from.parent.type.name !== 'action') {
            return false
          }

          const insertPos = $from.after($from.depth)
          editor
            .chain()
            .insertContentAt(insertPos, { type: 'action' })
            .focus(insertPos + 1)
            .run()
          return true
      }
    }
  },
})