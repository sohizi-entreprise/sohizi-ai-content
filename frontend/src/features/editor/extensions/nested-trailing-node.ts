import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

type NestedTrailingNodeOptions = {
  /** Block node inserted at the end of each container when needed. */
  node: string
  /** Container node names that should always end with `node` when their last child isn't already one. */
  containers: Array<string>
  /** Last-child types that should not get a trailing node after them. */
  notAfter: Array<string>
}

/**
 * Like TipTap's TrailingNode, but scoped to nested containers.
 * Needed for schemas where the top-level doc can't accept a trailing paragraph
 * (e.g. skillDescription / skillInstruction).
 */
export const NestedTrailingNode = Extension.create<NestedTrailingNodeOptions>({
  name: 'nestedTrailingNode',

  addOptions() {
    return {
      node: 'paragraph',
      containers: [],
      notAfter: ['paragraph'],
    }
  },

  addProseMirrorPlugins() {
    const pluginKey = new PluginKey(this.name)
    const { node: nodeName, containers, notAfter } = this.options

    return [
      new Plugin({
        key: pluginKey,
        appendTransaction: (_transactions, _oldState, state) => {
          const type = state.schema.nodes[nodeName]
          if (containers.length === 0) return null

          const insertPositions: Array<number> = []

          state.doc.descendants((node, pos) => {
            if (!containers.includes(node.type.name)) return true

            const lastChild = node.lastChild
            if (!lastChild || notAfter.includes(lastChild.type.name)) {
              return false
            }

            // Position just inside the end of the container.
            insertPositions.push(pos + 1 + node.content.size)
            return false
          })

          if (insertPositions.length === 0) return null

          const { tr } = state
          for (const insertPos of insertPositions.sort((a, b) => b - a)) {
            tr.insert(insertPos, type.create())
          }
          return tr
        },
      }),
    ]
  },
})
