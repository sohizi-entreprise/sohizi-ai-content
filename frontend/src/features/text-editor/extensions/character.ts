import { Node, mergeAttributes } from '@tiptap/core'
import { v4 as uuid } from 'uuid'

export interface CharacterOptions {
  HTMLAttributes: Record<string, unknown>
}

// Character voice/delivery extensions
export const CHARACTER_EXTENSIONS = [
  { value: '', label: 'None' },
  { value: 'V.O.', label: 'V.O. (Voice Over)' },
  { value: 'O.S.', label: 'O.S. (Off Screen)' },
  { value: 'O.C.', label: 'O.C. (Off Camera)' },
  { value: 'CONT\'D', label: 'CONT\'D (Continued)' },
  { value: 'FILTER', label: 'FILTER (Phone/Radio)' },
  { value: 'SUBTITLE', label: 'SUBTITLE' },
] as const

export type CharacterExtensionType = typeof CHARACTER_EXTENSIONS[number]['value']

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    character: {
      /**
       * Set a character block and auto-trigger @ mention
       */
      setCharacter: () => ReturnType
      /**
       * Toggle between character and paragraph
       */
      toggleCharacter: () => ReturnType
      /**
       * Set the character extension (V.O., O.S., etc.)
       */
      setCharacterExtension: (extension: CharacterExtensionType) => ReturnType
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

  // Allow inline content including mentions
  content: 'inline*',

  // Keep the block type when editing
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
        default: '',
        parseHTML: (element) => element.getAttribute('data-extension') || '',
        renderHTML: (attributes) => {
          if (!attributes.extension) return {}
          return { 'data-extension': attributes.extension }
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
        tag: 'div[data-type="character"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes, node }) {
    const extension = node.attrs.extension
    const classes = ['screenplay-character']
    if (extension) {
      classes.push('has-extension')
    }
    
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'character',
        'data-extension': extension || undefined,
        class: classes.join(' '),
      }),
      0, // Content hole - mentions go here
    ]
  },

  addCommands() {
    return {
      setCharacter:
        () =>
        ({ chain }) => {
          // Set the node and insert @ to trigger mention
          return chain()
            .setNode(this.name)
            .insertContent('@')
            .run()
        },
      toggleCharacter:
        () =>
        ({ commands }) => {
          return commands.toggleNode(this.name, 'paragraph')
        },
      setCharacterExtension:
        (extension: CharacterExtensionType) =>
        ({ commands }) => {
          return commands.updateAttributes(this.name, { extension })
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-3': () => this.editor.commands.setCharacter(),
      // When Enter is pressed in a character block, move into or create a parenthetical.
      'Enter': ({ editor }) => {
        const { state } = editor
        const { $from } = state.selection
        const parent = $from.parent
        
        // Only handle if we're in a character block
        if (parent.type.name !== 'character') {
          return false
        }

        const dialogueNode = $from.node($from.depth - 1)
        const dialogueContentStart = $from.before($from.depth - 1) + 1
        const insertPos = $from.after($from.depth)
        let parentheticalPos: number | null = null

        if (dialogueNode?.type.name === 'dialogue') {
          dialogueNode.forEach((child, offset) => {
            if (child.type.name === 'parenthetical' && parentheticalPos === null) {
              parentheticalPos = dialogueContentStart + offset
            }
          })
        }

        if (parentheticalPos !== null) {
          return editor.chain().focus(parentheticalPos + 1).run()
        }

        return editor.chain()
          .insertContentAt(insertPos, { type: 'parenthetical' })
          .focus(insertPos + 1)
          .run()
      },
    }
  },
})