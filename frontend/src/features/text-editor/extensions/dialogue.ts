import { Node, mergeAttributes } from '@tiptap/core'
import { v4 as uuid } from 'uuid'

export interface DialogueOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    dialogue: {
      setDialogue: () => ReturnType
      toggleDialogue: () => ReturnType
    }
  }
}

export const DialogueExtension = Node.create<DialogueOptions>({
  name: 'dialogue',

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
      characterId: {
        // Links to parent character block
        default: null,
        parseHTML: (element) => element.getAttribute('data-character-id'),
        renderHTML: (attributes) => {
          if (!attributes.characterId) return {}
          return { 'data-character-id': attributes.characterId }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="dialogue"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'dialogue',
        class: 'screenplay-dialogue',
      }),
      0,
    ]
  },

  addCommands() {
    return {
      setDialogue:
        () =>
        ({ commands }) => {
          return commands.setNode(this.name)
        },
      toggleDialogue:
        () =>
        ({ commands }) => {
          return commands.toggleNode(this.name, 'paragraph')
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-5': () => this.editor.commands.setDialogue(),
    }
  },
})
