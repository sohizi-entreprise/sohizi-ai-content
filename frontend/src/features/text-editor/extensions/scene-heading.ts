import { Node, mergeAttributes } from '@tiptap/core'
import { v4 as uuid } from 'uuid'


export interface SluglineOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    slugline: {
      setSlugline: () => ReturnType
      toggleSlugline: () => ReturnType
    }
  }
}

export const SluglineExtension = Node.create<SluglineOptions>({
  name: 'slugline',

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
      sceneNumber: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-scene-number'),
        renderHTML: (attributes) => {
          if (!attributes.sceneNumber) return {}
          return { 'data-scene-number': attributes.sceneNumber }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="slugline"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'slugline',
        class: 'screenplay-slugline',
      }),
      0,
    ]
  },

  addCommands() {
    return {
      setSlugline:
        () =>
        ({ commands }) => {
          return commands.setNode(this.name)
        },
      toggleSlugline:
        () =>
        ({ commands }) => {
          return commands.toggleNode(this.name, 'paragraph')
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-1': () => this.editor.commands.setSlugline(),

      // Pressing Enter in a slugline should create the first action block of the scene.
      'Enter': ({ editor }) => {
        const { $from } = editor.state.selection

        if ($from.parent.type.name !== 'slugline') {
          return false
        }

        const insertPos = $from.after($from.depth)

        return editor
          .chain()
          .insertContentAt(insertPos, { type: 'action' })
          .focus(insertPos + 1)
          .run()
      },
    }
  },
})
