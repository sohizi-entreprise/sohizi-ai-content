import { useCallback, useEffect } from 'react'
import type { Editor } from '@tiptap/react'
import { useEditorStore } from '../store/editor-store'
import type { AISuggestion } from '../store/types'
import { generateDiffHTML } from '../utils/diff'

/**
 * Hook for managing AI diffs and suggestions in the synopsis editor.
 * Subscribes to the editor store and applies visual diffs to TipTap nodes by blockId.
 */
export function useAIDiff(editor: Editor | null) {
  const {
    pendingSuggestions,
    showDiffs,
    addSuggestion,
    acceptSuggestion,
    rejectSuggestion,
    clearSuggestions,
    toggleShowDiffs,
  } = useEditorStore()

  /**
   * Find a node's position by its blockId attribute
   */
  const findNodeByBlockId = useCallback(
    (blockId: string): { pos: number; node: any } | null => {
      if (!editor) return null

      let found: { pos: number; node: any } | null = null
      editor.state.doc.descendants((node, pos) => {
        if (node.attrs?.blockId === blockId) {
          found = { pos, node }
          return false
        }
      })
      return found
    },
    [editor]
  )

  /**
   * Apply visual diff marks for a suggestion.
   * For replacements: show deleted text (strikethrough) and new text (highlighted).
   * For insertions: show new text with addition mark.
   * For deletions: show text with deletion mark.
   */
  const applyVisualDiff = useCallback(
    (suggestion: AISuggestion) => {
      if (!editor || !showDiffs) return

      const result = findNodeByBlockId(suggestion.blockId)
      if (!result) return

      const { pos, node } = result

      if (suggestion.type === 'replacement' && suggestion.originalContent) {
        const diffHtml = generateDiffHTML(
          suggestion.originalContent,
          suggestion.content,
          suggestion.id
        )

        // Replace the node's text content with diff HTML
        const from = pos + 1 // +1 to get inside the node
        const to = from + node.content.size

        editor
          .chain()
          .focus()
          .deleteRange({ from, to })
          .insertContentAt(from, diffHtml, { parseOptions: { preserveWhitespace: 'full' } })
          .run()
      } else if (suggestion.type === 'insertion') {
        // For new content nodes, wrap the text in an addition mark
        const from = pos + 1
        const to = from + node.content.size
        if (to > from) {
          editor.chain().focus().setTextSelection({ from, to }).setAIAddition({ suggestionId: suggestion.id }).run()
        }
      } else if (suggestion.type === 'deletion') {
        // Mark the entire node content for deletion
        const from = pos + 1
        const to = from + node.content.size
        if (to > from) {
          editor.chain().focus().setTextSelection({ from, to }).setAIDeletion({ suggestionId: suggestion.id }).run()
        }
      }
    },
    [editor, showDiffs, findNodeByBlockId]
  )

  /**
   * Accept a suggestion: keep the new content, remove diff marks
   */
  const accept = useCallback(
    (suggestionId: string) => {
      const suggestion = pendingSuggestions.find((s) => s.id === suggestionId)
      if (!suggestion || !editor) return

      acceptSuggestion(suggestionId)

      // Remove all diff marks for this suggestion
      const { state } = editor
      const { tr } = state

      state.doc.descendants((node, pos) => {
        if (node.isText) {
          node.marks.forEach((mark) => {
            if (
              (mark.type.name === 'aiAddition' || mark.type.name === 'aiDeletion') &&
              mark.attrs.suggestionId === suggestionId
            ) {
              if (mark.type.name === 'aiDeletion') {
                // For accepted deletion: remove the deleted text entirely
                tr.delete(pos, pos + node.nodeSize)
              } else {
                // For accepted addition: just remove the mark, keep the text
                tr.removeMark(pos, pos + node.nodeSize, mark.type)
              }
            }
          })
        }
      })

      editor.view.dispatch(tr)
    },
    [editor, pendingSuggestions, acceptSuggestion]
  )

  /**
   * Reject a suggestion: revert to original content, remove diff marks
   */
  const reject = useCallback(
    (suggestionId: string) => {
      const suggestion = pendingSuggestions.find((s) => s.id === suggestionId)
      if (!suggestion || !editor) return

      rejectSuggestion(suggestionId)

      if (suggestion.type === 'replacement' && suggestion.originalContent) {
        // Restore original text by replacing the block content
        const result = findNodeByBlockId(suggestion.blockId)
        if (result) {
          const { pos, node } = result
          const from = pos + 1
          const to = from + node.content.size

          editor
            .chain()
            .focus()
            .deleteRange({ from, to })
            .insertContentAt(from, suggestion.originalContent)
            .run()
        }
      } else {
        // For insertion/deletion rejections, remove all diff marks
        const { state } = editor
        const { tr } = state

        state.doc.descendants((node, pos) => {
          if (node.isText) {
            node.marks.forEach((mark) => {
              if (
                (mark.type.name === 'aiAddition' || mark.type.name === 'aiDeletion') &&
                mark.attrs.suggestionId === suggestionId
              ) {
                if (mark.type.name === 'aiAddition') {
                  // Reject addition: remove the added text
                  tr.delete(pos, pos + node.nodeSize)
                } else {
                  // Reject deletion: keep the text, just remove the mark
                  tr.removeMark(pos, pos + node.nodeSize, mark.type)
                }
              }
            })
          }
        })

        editor.view.dispatch(tr)
      }
    },
    [editor, pendingSuggestions, rejectSuggestion, findNodeByBlockId]
  )

  /**
   * Accept all pending suggestions
   */
  const acceptAll = useCallback(() => {
    pendingSuggestions
      .filter((s) => s.status === 'pending')
      .forEach((s) => accept(s.id))
  }, [pendingSuggestions, accept])

  /**
   * Reject all pending suggestions
   */
  const rejectAll = useCallback(() => {
    pendingSuggestions
      .filter((s) => s.status === 'pending')
      .forEach((s) => reject(s.id))
  }, [pendingSuggestions, reject])

  // Auto-apply visual diffs when new suggestions arrive
  useEffect(() => {
    if (!editor || !showDiffs) return

    const pendingToApply = pendingSuggestions.filter(s => s.status === 'pending')
    for (const suggestion of pendingToApply) {
      applyVisualDiff(suggestion)
    }
  // Only run when the count of pending suggestions changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSuggestions.length])

  const pendingCount = pendingSuggestions.filter(
    (s) => s.status === 'pending'
  ).length

  return {
    pendingSuggestions,
    showDiffs,
    pendingCount,
    applyVisualDiff,
    accept,
    reject,
    acceptAll,
    rejectAll,
    clearSuggestions,
    toggleShowDiffs,
    addSuggestion,
  }
}
