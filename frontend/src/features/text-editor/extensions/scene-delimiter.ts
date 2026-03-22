import { Node, mergeAttributes } from '@tiptap/core'
import { v4 as uuid } from 'uuid'

export interface SceneDelimiterOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    sceneDelimiter: {
      insertSceneDelimiter: () => ReturnType
      insertSceneAtDelimiter: (pos: number) => ReturnType
    }
  }
}

export const SceneDelimiterExtension = Node.create<SceneDelimiterOptions>({
  name: 'sceneDelimiter',

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  group: 'block',

  atom: true,

  selectable: true,

  draggable: false,

  parseHTML() {
    return [
      {
        tag: 'div[data-type="scene-delimiter"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'scene-delimiter',
        class: 'screenplay-scene-delimiter',
      }),
      [
        'div',
        { class: 'scene-delimiter-line' },
      ],
      [
        'button',
        { 
          class: 'scene-delimiter-button',
          type: 'button',
          'aria-label': 'Add new scene',
        },
        [
          'span',
          { class: 'scene-delimiter-icon' },
          '+',
        ],
      ],
      [
        'div',
        { class: 'scene-delimiter-line' },
      ],
    ]
  },

  addCommands() {
    return {
      insertSceneDelimiter:
        () =>
        ({ commands }) => {
          return commands.insertContent({ type: this.name })
        },
      insertSceneAtDelimiter:
        (pos: number) =>
        ({ chain }) => {
          return chain()
            .insertContentAt(pos + 1, {
              type: 'scene',
              attrs: { id: uuid() },
              content: [
                { type: 'slugline' },
              ],
            })
            .focus(pos + 3)
            .run()
        },
    }
  },

  addNodeView() {
    return ({ node, HTMLAttributes, getPos, editor }) => {
      const dom = document.createElement('div')
      dom.setAttribute('data-type', 'scene-delimiter')
      dom.className = 'screenplay-scene-delimiter'
      
      Object.entries(HTMLAttributes).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          dom.setAttribute(key, String(value))
        }
      })

      const leftLine = document.createElement('div')
      leftLine.className = 'scene-delimiter-line'
      
      const button = document.createElement('button')
      button.className = 'scene-delimiter-button'
      button.type = 'button'
      button.setAttribute('aria-label', 'Add new scene')
      button.innerHTML = '<span class="scene-delimiter-icon">+</span>'
      
      button.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        
        const pos = typeof getPos === 'function' ? getPos() : null
        if (pos !== null && pos !== undefined) {
          const delimiterSize = node.nodeSize
          const insertPos = pos + delimiterSize
          
          editor
            .chain()
            .insertContentAt(insertPos, {
              type: 'scene',
              attrs: { id: uuid() },
              content: [
                { type: 'slugline' },
              ],
            })
            .focus(insertPos + 2)
            .run()
        }
      })

      const rightLine = document.createElement('div')
      rightLine.className = 'scene-delimiter-line'

      dom.appendChild(leftLine)
      dom.appendChild(button)
      dom.appendChild(rightLine)

      return {
        dom,
        contentDOM: null,
        ignoreMutation: () => true,
      }
    }
  },
})
