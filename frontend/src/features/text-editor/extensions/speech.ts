import { Node, mergeAttributes } from '@tiptap/core'
import { v4 as uuid } from 'uuid'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    speech: {
        setSpeech: () => ReturnType
        toggleSpeech: () => ReturnType
    }
  }
}

export interface BaseOptions {
    HTMLAttributes: Record<string, unknown>
}

export const SpeechExtension = Node.create<BaseOptions>({
    name: 'speech',
  
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
        }
      }
    },
  
    parseHTML() {
      return [
        {
          tag: 'div[data-type="speech"]',
        },
      ]
    },
  
    renderHTML({ HTMLAttributes }) {
      return [
        'div',
        mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
          'data-type': 'speech',
          class: 'screenplay-speech',
        }),
        0,
      ]
    },
  
    addCommands() {
      return {
        setSpeech:
          () =>
          ({ commands }) => {
            return commands.setNode(this.name)
          },
        toggleSpeech:
          () =>
          ({ commands }) => {
            return commands.toggleNode(this.name, 'paragraph')
          },
      }
    },
  
    addKeyboardShortcuts() {
      return {
        'Mod-5': () => this.editor.commands.setSpeech(),
        'Enter': ({ editor }) => {
          const { $from } = editor.state.selection

          if ($from.parent.type.name !== 'speech') {
            return false
          }

          let dialogueDepth: number | null = null

          for (let depth = $from.depth; depth >= 0; depth -= 1) {
            if ($from.node(depth).type.name === 'dialogue') {
              dialogueDepth = depth
              break
            }
          }

          if (dialogueDepth === null) {
            return false
          }

          const dialoguePos = $from.before(dialogueDepth)
          const dialogueNode = $from.node(dialogueDepth)
          const insertPos = dialoguePos + dialogueNode.nodeSize

          return editor.chain()
            .insertContentAt(insertPos, {
              type: 'dialogue',
              attrs: { id: uuid() },
              content: [
                { type: 'character' },
              ],
            })
            .focus(insertPos + 2)
            .run()
        },
      }
    },
})