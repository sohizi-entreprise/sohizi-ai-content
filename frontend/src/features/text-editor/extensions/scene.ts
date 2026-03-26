import { Node, mergeAttributes } from '@tiptap/core'
import { TextSelection, type Transaction } from '@tiptap/pm/state'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { v4 as uuid } from 'uuid'
import { Fragment, type Node as ProseMirrorNode } from '@tiptap/pm/model'
import SceneComponent from '../components/scene-component'

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

  content: 'slugline (action | dialogue)* transition?',

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
      }),
      0,
    ]
  },

  addCommands() {
    return {
      setScene:
        () =>
        ({ state, dispatch }) => {
          const insertPos = state.selection.from
          const sceneNumber = countScenesBeforePos(state.doc, insertPos) + 1
          const sceneNode = state.schema.nodes.scene.create(
            { id: uuid(), sceneNumber },
            [state.schema.nodes.slugline.create()],
          )

          let tr = state.tr.insert(insertPos, sceneNode)
          tr = renumberScenesFrom(tr, insertPos, sceneNumber)
          tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 2)))

          dispatch?.(tr)
          return true
        },
      addSceneAfter:
        () =>
        ({ state, dispatch }) => {
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
          const sceneNumber = countScenesBeforePos(state.doc, insertPos) + 1
          const delimiterNode = state.schema.nodes.sceneDelimiter.create()
          const newSceneNode = state.schema.nodes.scene.create(
            { id: uuid(), sceneNumber },
            [state.schema.nodes.slugline.create()],
          )

          let tr = state.tr.insert(
            insertPos,
            Fragment.fromArray([delimiterNode, newSceneNode]),
          )
          tr = renumberScenesFrom(tr, insertPos + delimiterNode.nodeSize, sceneNumber)
          tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 3)))

          dispatch?.(tr)
          return true
        },
      addSceneWithDelimiter:
        () =>
        ({ state, dispatch }) => {
          const { doc } = state
          const insertPos = doc.content.size
          const sceneNumber = countScenesBeforePos(doc, insertPos) + 1
          const delimiterNode = state.schema.nodes.sceneDelimiter.create()
          const newSceneNode = state.schema.nodes.scene.create(
            { id: uuid(), sceneNumber },
            [state.schema.nodes.slugline.create()],
          )

          let tr = state.tr.insert(
            insertPos,
            Fragment.fromArray([delimiterNode, newSceneNode]),
          )
          tr = renumberScenesFrom(tr, insertPos + delimiterNode.nodeSize, sceneNumber)
          tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 3)))

          dispatch?.(tr)
          return true
        },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(SceneComponent)
  },

  addKeyboardShortcuts() {
    return {
      'Mod-=': () => this.editor.commands.addSceneAfter(),
      'Mod-Plus': () => this.editor.commands.addSceneAfter(),
    }
  },
})


function countScenesBeforePos(doc: ProseMirrorNode, pos: number){
  let count = 0

  doc.nodesBetween(0, pos, (node, nodePos) => {
    if (node.type.name === 'scene' && nodePos < pos) {
      count += 1
      return false
    }

    return true
  })

  return count
}

function renumberScenesFrom(
  tr: Transaction,
  fromPos: number,
  startingSceneNumber: number,
){
  let sceneNumber = startingSceneNumber

  tr.doc.nodesBetween(fromPos, tr.doc.content.size, (node: ProseMirrorNode, pos: number) => {
    if (node.type.name !== 'scene') {
      return true
    }

    if (node.attrs.sceneNumber !== sceneNumber) {
      tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        sceneNumber,
      })
    }

    sceneNumber += 1
    return false
  })

  return tr
}
