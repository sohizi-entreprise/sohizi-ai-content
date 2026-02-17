import { Node, mergeAttributes } from '@tiptap/core'
import { v4 as uuid } from 'uuid'

export interface TransitionOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    transition: {
      setTransition: () => ReturnType
      toggleTransition: () => ReturnType
    }
  }
}

export const TransitionExtension = Node.create<TransitionOptions>({
  name: 'transition',

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
        tag: 'div[data-type="transition"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'transition',
        class: 'screenplay-transition',
      }),
      0,
    ]
  },

  addCommands() {
    return {
      setTransition:
        () =>
        ({ commands }) => {
          return commands.setNode(this.name)
        },
      toggleTransition:
        () =>
        ({ commands }) => {
          return commands.toggleNode(this.name, 'paragraph')
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-6': () => this.editor.commands.setTransition(),
    }
  },

  addInputRules() {
    return [
      // Auto-convert common transitions
      {
        find: /^(CUT TO:|FADE OUT:|FADE IN:|DISSOLVE TO:|SMASH CUT TO:)\s*$/,
        handler: ({ state, range, match }) => {
          const { tr } = state
          const start = range.from
          const end = range.to

          tr.replaceWith(start, end, this.type.create({}, state.schema.text(match[1])))
        },
      },
    ]
  },
})
