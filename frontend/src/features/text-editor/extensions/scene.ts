import { Node, mergeAttributes } from '@tiptap/core'
import { v4 as uuid } from 'uuid'

export interface SceneOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    scene: {
      setScene: () => ReturnType
      addSceneAfter: () => ReturnType
      addSceneWithDelimiter: () => ReturnType
    }
  }
}

export const SceneExtension = Node.create<SceneOptions>({
  name: 'scene',

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  group: 'block',

  content: 'slugline (action | character | dialogue | parenthetical | shot | note)* transition?',

  defining: true,

  isolating: true,

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
        tag: 'div[data-type="scene"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'scene',
        class: 'screenplay-scene',
      }),
      0,
    ]
  },

  addCommands() {
    return {
      setScene:
        () =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { id: uuid() },
            content: [
              { type: 'slugline' },
            ],
          })
        },
      addSceneAfter:
        () =>
        ({ state, chain }) => {
          const { selection } = state
          const { $from } = selection
          
          let scenePos = null
          let sceneNode = null
          
          for (let depth = $from.depth; depth >= 0; depth--) {
            const node = $from.node(depth)
            if (node.type.name === 'scene') {
              scenePos = $from.before(depth)
              sceneNode = node
              break
            }
          }
          
          if (scenePos === null || !sceneNode) {
            return false
          }
          
          const insertPos = scenePos + sceneNode.nodeSize
          
          return chain()
            .insertContentAt(insertPos, [
              { type: 'sceneDelimiter' },
              {
                type: 'scene',
                attrs: { id: uuid() },
                content: [
                  { type: 'slugline' },
                ],
              },
            ])
            .focus(insertPos + 2)
            .run()
        },
      addSceneWithDelimiter:
        () =>
        ({ state, chain }) => {
          const { doc } = state
          const insertPos = doc.content.size
          
          return chain()
            .insertContentAt(insertPos, [
              { type: 'sceneDelimiter' },
              {
                type: 'scene',
                attrs: { id: uuid() },
                content: [
                  { type: 'slugline' },
                ],
              },
            ])
            .focus()
            .run()
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-=': () => this.editor.commands.addSceneAfter(),
      'Mod-Plus': () => this.editor.commands.addSceneAfter(),
    }
  },
})
