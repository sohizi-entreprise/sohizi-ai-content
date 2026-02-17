import { Node, mergeAttributes } from '@tiptap/core'
import { v4 as uuid } from 'uuid'

// Pattern to match scene headings: INT., EXT., INT/EXT., I/E. followed by location
const SCENE_HEADING_PATTERN = /^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)\s+.+/i

export interface SceneHeadingOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    sceneHeading: {
      setSceneHeading: () => ReturnType
      toggleSceneHeading: () => ReturnType
    }
  }
}

export const SceneHeadingExtension = Node.create<SceneHeadingOptions>({
  name: 'sceneHeading',

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
        tag: 'div[data-type="scene-heading"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'scene-heading',
        class: 'screenplay-scene-heading',
      }),
      0,
    ]
  },

  addCommands() {
    return {
      setSceneHeading:
        () =>
        ({ commands }) => {
          return commands.setNode(this.name)
        },
      toggleSceneHeading:
        () =>
        ({ commands }) => {
          return commands.toggleNode(this.name, 'paragraph')
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-1': () => this.editor.commands.setSceneHeading(),
      
      // On Enter, check if current line matches scene heading pattern
      'Enter': () => {
        const { state } = this.editor
        const { selection } = state
        const { $from } = selection
        
        // Get the current block
        const currentNode = $from.parent
        
        // Only process if we're in a paragraph
        if (currentNode.type.name !== 'paragraph') {
          return false // Let default Enter behavior happen
        }
        
        // Get the text content of the current block
        const textContent = currentNode.textContent
        
        // Check if it matches scene heading pattern
        if (SCENE_HEADING_PATTERN.test(textContent)) {
          // Convert to scene heading and then create a new paragraph
          const blockStart = $from.start()
          const blockEnd = $from.end()
          
          this.editor
            .chain()
            .command(({ tr }) => {
              tr.setBlockType(blockStart - 1, blockEnd + 1, this.type)
              return true
            })
            .insertContentAt(blockEnd + 1, { type: 'paragraph' })
            .focus()
            .run()
          
          return true // Prevent default Enter behavior
        }
        
        return false // Let default Enter behavior happen
      },
    }
  },
})
