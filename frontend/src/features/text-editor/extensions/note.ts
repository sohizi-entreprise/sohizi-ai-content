import { Node, mergeAttributes } from '@tiptap/core'
import { v4 as uuid } from 'uuid'

export interface NoteOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    note: {
      setNote: () => ReturnType
      toggleNote: () => ReturnType
    }
  }
}

export const NoteExtension = Node.create<NoteOptions>({
  name: 'note',

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
      author: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-author'),
        renderHTML: (attributes) => {
          if (!attributes.author) return {}
          return { 'data-author': attributes.author }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="note"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'note',
        class: 'screenplay-note',
      }),
      0,
    ]
  },

  addCommands() {
    return {
      setNote:
        () =>
        ({ commands }) => {
          return commands.setNode(this.name)
        },
      toggleNote:
        () =>
        ({ commands }) => {
          return commands.toggleNode(this.name, 'paragraph')
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-8': () => this.editor.commands.setNote(),
    }
  },
})
