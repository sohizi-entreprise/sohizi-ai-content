import { Mark, mergeAttributes } from '@tiptap/core'

// ============================================================================
// TYPES
// ============================================================================

export interface ContextAnchorOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    contextAnchor: {
      /**
       * Set a context anchor mark on the current selection
       */
      setContextAnchor: (attributes: { blockId: string }) => ReturnType
      /**
       * Remove a specific context anchor by block ID
       */
      unsetContextAnchor: (blockId: string) => ReturnType
      /**
       * Remove all context anchors from the document
       */
      unsetAllContextAnchors: () => ReturnType
    }
  }
}

// ============================================================================
// CONTEXT ANCHOR MARK
// ============================================================================

/**
 * ContextAnchorMark - Wraps selected text with a UUID for AI context reference
 * 
 * When user selects text and presses Cmd+K, this mark is applied to identify
 * the selection. The AI can then reference this anchor ID to apply targeted edits.
 */
export const ContextAnchorMark = Mark.create<ContextAnchorOptions>({
  name: 'contextAnchor',

  // Allow multiple context anchors to overlap and coexist with other marks
  inclusive: false,
  excludes: '',

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      blockId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-block-id'),
        renderHTML: (attributes) => {
          if (!attributes.blockId) return {}
          return { 'data-block-id': attributes.blockId }
        },
      },
    }
  },

  parseHTML() {
    return [
      { tag: 'span[data-block-id]' },
      { tag: 'span.context-anchor' },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'context-anchor',
        'data-context-anchor': 'true',
      }),
      0,
    ]
  },

  addCommands() {
    return {
      setContextAnchor:
        (attributes) =>
        ({ commands }) => {
          return commands.setMark(this.name, attributes)
        },

      unsetContextAnchor:
        (blockId) =>
        ({ tr, state, dispatch }) => {
          const markType = state.schema.marks.contextAnchor
          if (!markType) return false

          let found = false

          // Traverse the document to find and remove the specific anchor
          state.doc.descendants((node, pos) => {
            if (!node.isText) return

            const anchor = node.marks.find(
              (mark) =>
                mark.type === markType && mark.attrs.blockId === blockId
            )

            if (anchor) {
              tr.removeMark(pos, pos + node.nodeSize, anchor)
              found = true
            }
          })

          if (found && dispatch) {
            dispatch(tr)
          }

          return found
        },

      unsetAllContextAnchors:
        () =>
        ({ tr, state, dispatch }) => {
          const markType = state.schema.marks.contextAnchor
          if (!markType) return false

          tr.removeMark(0, state.doc.content.size, markType)

          if (dispatch) {
            dispatch(tr)
          }

          return true
        },
    }
  },
})

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Find a context anchor by its block ID in the editor
 * Returns the position range of the anchor or null if not found
 */
export function findContextAnchorById(
  editor: { state: { doc: { descendants: Function }; schema: { marks: Record<string, unknown> } } },
  blockId: string
): { from: number; to: number; text: string } | null {
  let result: { from: number; to: number; text: string } | null = null
  const markType = editor.state.schema.marks.contextAnchor

  if (!markType) return null

  editor.state.doc.descendants((node: { isText: boolean; marks: Array<{ type: unknown; attrs: { blockId: string } }>; text?: string; nodeSize: number }, pos: number) => {
    if (!node.isText) return

    const anchor = node.marks.find(
      (mark) => mark.type === markType && mark.attrs.blockId === blockId
    )

    if (anchor && node.text) {
      result = {
        from: pos,
        to: pos + node.nodeSize,
        text: node.text,
      }
    }
  })

  return result
}

/**
 * Get all context anchors in the document
 */
export function getAllContextAnchors(
  editor: { state: { doc: { descendants: Function }; schema: { marks: Record<string, unknown> } } }
): Array<{ blockId: string; from: number; to: number; text: string }> {
  const anchors: Array<{ blockId: string; from: number; to: number; text: string }> = []
  const markType = editor.state.schema.marks.contextAnchor

  if (!markType) return anchors

  editor.state.doc.descendants((node: { isText: boolean; marks: Array<{ type: unknown; attrs: { blockId: string } }>; text?: string; nodeSize: number }, pos: number) => {
    if (!node.isText) return

    node.marks.forEach((mark) => {
      if (mark.type === markType && node.text) {
        anchors.push({
          blockId: mark.attrs.blockId,
          from: pos,
          to: pos + node.nodeSize,
          text: node.text,
        })
      }
    })
  })

  return anchors
}
