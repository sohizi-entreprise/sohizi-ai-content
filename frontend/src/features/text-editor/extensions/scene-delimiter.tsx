import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'

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
    ]
  },

  addCommands() {
    return {
      insertSceneDelimiter:
        () =>
        ({ commands }) => {
          return commands.insertContent({ type: this.name })
        },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(SceneDelimiterComponent)
  },
})


function SceneDelimiterComponent(){

  return (
      <NodeViewWrapper className="flex items-center gap-2 my-6">
          <div className="flex-1 border-b border-dashed border-gray-400" />
      </NodeViewWrapper>
  )
}