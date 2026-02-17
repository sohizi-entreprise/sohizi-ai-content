import { Node, mergeAttributes } from '@tiptap/core'
import { v4 as uuid } from 'uuid'

export interface ShotOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    shot: {
      setShot: () => ReturnType
      toggleShot: () => ReturnType
    }
  }
}

export const ShotExtension = Node.create<ShotOptions>({
  name: 'shot',

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
      shotType: {
        // CLOSE UP, WIDE SHOT, etc.
        default: null,
        parseHTML: (element) => element.getAttribute('data-shot-type'),
        renderHTML: (attributes) => {
          if (!attributes.shotType) return {}
          return { 'data-shot-type': attributes.shotType }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="shot"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'shot',
        class: 'screenplay-shot',
      }),
      0,
    ]
  },

  addCommands() {
    return {
      setShot:
        () =>
        ({ commands }) => {
          return commands.setNode(this.name)
        },
      toggleShot:
        () =>
        ({ commands }) => {
          return commands.toggleNode(this.name, 'paragraph')
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-7': () => this.editor.commands.setShot(),
    }
  },
})
