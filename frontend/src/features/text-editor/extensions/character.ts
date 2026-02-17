import { Node, mergeAttributes } from '@tiptap/core'
import { v4 as uuid } from 'uuid'

export interface CharacterOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    character: {
      setCharacter: () => ReturnType
      toggleCharacter: () => ReturnType
    }
  }
}

export const CharacterExtension = Node.create<CharacterOptions>({
  name: 'character',

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
      extension: {
        // For (V.O.), (O.S.), (CONT'D), etc.
        default: null,
        parseHTML: (element) => element.getAttribute('data-extension'),
        renderHTML: (attributes) => {
          if (!attributes.extension) return {}
          return { 'data-extension': attributes.extension }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="character"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'character',
        class: 'screenplay-character',
      }),
      0,
    ]
  },

  addCommands() {
    return {
      setCharacter:
        () =>
        ({ commands }) => {
          return commands.setNode(this.name)
        },
      toggleCharacter:
        () =>
        ({ commands }) => {
          return commands.toggleNode(this.name, 'paragraph')
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-3': () => this.editor.commands.setCharacter(),
    }
  },
})
