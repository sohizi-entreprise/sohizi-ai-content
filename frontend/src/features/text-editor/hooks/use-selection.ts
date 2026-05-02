import { useEffect, useCallback } from 'react'
import type { Editor } from '@tiptap/react'
import { useOldEditorStore } from '../store/editor-store'
import type { SelectionContext, Block, BlockType } from '../store/types'

/**
 * Hook to track and manage editor selection
 */
export function useSelection(editor: Editor | null) {
  const { selection, setSelection, clearSelection } = useOldEditorStore()

  // Update selection when editor selection changes
  useEffect(() => {
    if (!editor) return

    const updateSelection = () => {
      const { from, to } = editor.state.selection

      if (from === to) {
        clearSelection()
        return
      }

      const text = editor.state.doc.textBetween(from, to, ' ')
      const blocks: Block[] = []

      editor.state.doc.nodesBetween(from, to, (node) => {
        if (node.attrs?.id) {
          blocks.push({
            id: node.attrs.id,
            type: node.type.name as BlockType,
            parentId: null,
            data: {
              content: node.textContent,
            },
          })
        }
      })

      setSelection({
        blocks,
        text,
        range: { from, to },
      })
    }

    editor.on('selectionUpdate', updateSelection)

    return () => {
      editor.off('selectionUpdate', updateSelection)
    }
  }, [editor, setSelection, clearSelection])

  /**
   * Get formatted selection for AI context
   */
  const getFormattedContext = useCallback((): string => {
    if (!selection) return ''

    const blockDescriptions = selection.blocks.map((block) => {
      return `[${block.type.toUpperCase()}] ${block.data.content}`
    })

    return blockDescriptions.join('\n')
  }, [selection])

  /**
   * Check if there's an active selection
   */
  const hasSelection = selection !== null && selection.text.length > 0

  /**
   * Get selection as markdown
   */
  const getSelectionAsMarkdown = useCallback((): string => {
    if (!selection) return ''

    return selection.blocks
      .map((block) => {
        switch (block.type) {
          case 'scene-heading':
            return `## ${block.data.content}`
          case 'character':
            return `**${block.data.content}**`
          case 'dialogue':
            return `> ${block.data.content}`
          case 'parenthetical':
            return `_(${block.data.content})_`
          case 'transition':
            return `---\n${block.data.content}\n---`
          default:
            return block.data.content
        }
      })
      .join('\n\n')
  }, [selection])

  return {
    selection,
    hasSelection,
    getFormattedContext,
    getSelectionAsMarkdown,
    clearSelection,
  }
}
