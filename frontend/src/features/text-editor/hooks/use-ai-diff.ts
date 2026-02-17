import { useCallback } from 'react'
import type { Editor } from '@tiptap/react'
import { useEditorStore } from '../store/editor-store'
import type { AISuggestion } from '../store/types'
import { computeDiff, generateDiffHTML } from '../utils/diff'
import { v4 as uuid } from 'uuid'

/**
 * Hook for managing AI diffs and suggestions
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
   * Create a suggestion from AI output
   */
  const createSuggestion = useCallback(
    (params: {
      blockId: string
      type: AISuggestion['type']
      content: string
      originalContent?: string
      reason?: string
    }): AISuggestion => {
      const suggestion: AISuggestion = {
        id: uuid(),
        blockId: params.blockId,
        type: params.type,
        content: params.content,
        originalContent: params.originalContent,
        reason: params.reason,
        status: 'pending',
      }

      addSuggestion(suggestion)
      return suggestion
    },
    [addSuggestion]
  )

  /**
   * Apply a text replacement and show diff
   */
  const applyReplacement = useCallback(
    (blockId: string, originalText: string, newText: string, reason?: string) => {
      if (!editor) return null

      // Create suggestion
      const suggestion = createSuggestion({
        blockId,
        type: 'replacement',
        content: newText,
        originalContent: originalText,
        reason,
      })

      // Compute diff
      const diff = computeDiff(originalText, newText)

      if (diff.hasChanges && showDiffs) {
        // Generate HTML with diff marks
        const diffHTML = generateDiffHTML(originalText, newText, suggestion.id)

        // Find the block in the editor and replace content
        // This is simplified - in production you'd need to find exact position
        const { state } = editor
        let blockPos: number | null = null

        state.doc.descendants((node, pos) => {
          if (node.attrs?.id === blockId) {
            blockPos = pos
            return false
          }
        })

        if (blockPos !== null) {
          // Replace block content with diff HTML
          // Note: This is a simplified implementation
          // A full implementation would need to handle this more carefully
        }
      }

      return suggestion
    },
    [editor, createSuggestion, showDiffs]
  )

  /**
   * Apply an insertion
   */
  const applyInsertion = useCallback(
    (blockId: string, content: string, reason?: string) => {
      return createSuggestion({
        blockId,
        type: 'insertion',
        content,
        reason,
      })
    },
    [createSuggestion]
  )

  /**
   * Apply a deletion
   */
  const applyDeletion = useCallback(
    (blockId: string, content: string, reason?: string) => {
      return createSuggestion({
        blockId,
        type: 'deletion',
        content,
        originalContent: content,
        reason,
      })
    },
    [createSuggestion]
  )

  /**
   * Add an AI comment
   */
  const addAIComment = useCallback(
    (blockId: string, content: string) => {
      return createSuggestion({
        blockId,
        type: 'comment',
        content,
      })
    },
    [createSuggestion]
  )

  /**
   * Accept a suggestion and apply the change
   */
  const accept = useCallback(
    (suggestionId: string) => {
      const suggestion = pendingSuggestions.find((s) => s.id === suggestionId)
      if (!suggestion || !editor) return

      acceptSuggestion(suggestionId)

      // Apply the actual change to the editor
      if (suggestion.type === 'replacement') {
        // Find the block and replace its content
        // Remove diff marks
        editor.chain().focus().unsetMark('aiDiff').run()
      } else if (suggestion.type === 'insertion') {
        // Insert the content
      } else if (suggestion.type === 'deletion') {
        // Delete the content
      }
    },
    [editor, pendingSuggestions, acceptSuggestion]
  )

  /**
   * Reject a suggestion and revert
   */
  const reject = useCallback(
    (suggestionId: string) => {
      const suggestion = pendingSuggestions.find((s) => s.id === suggestionId)
      if (!suggestion || !editor) return

      rejectSuggestion(suggestionId)

      // Revert the change in the editor
      if (suggestion.type === 'replacement' && suggestion.originalContent) {
        // Restore original content
        editor.chain().focus().unsetMark('aiDiff').run()
      }
    },
    [editor, pendingSuggestions, rejectSuggestion]
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

  /**
   * Get pending suggestion count
   */
  const pendingCount = pendingSuggestions.filter(
    (s) => s.status === 'pending'
  ).length

  return {
    // State
    pendingSuggestions,
    showDiffs,
    pendingCount,

    // Actions
    createSuggestion,
    applyReplacement,
    applyInsertion,
    applyDeletion,
    addAIComment,
    accept,
    reject,
    acceptAll,
    rejectAll,
    clearSuggestions,
    toggleShowDiffs,
  }
}
