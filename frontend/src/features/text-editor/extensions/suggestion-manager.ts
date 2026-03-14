import type { Editor } from '@tiptap/core'
import { findContextAnchorById } from './context-anchor'

// ============================================================================
// TYPES
// ============================================================================

export type AIEditOperation =
  | { type: 'replace'; blockId: string; newContent: string }
  | { type: 'insert_before'; blockId: string; content: string }
  | { type: 'insert_after'; blockId: string; content: string }
  | { type: 'delete'; blockId: string }

export type AIEditSuggestion = {
  suggestionId: string
  operations: AIEditOperation[]
  explanation?: string
}

export type SuggestionState = {
  suggestionId: string
  status: 'pending' | 'accepted' | 'rejected'
  operations: AIEditOperation[]
}

// ============================================================================
// SUGGESTION MANAGER
// ============================================================================

/**
 * Manages AI edit suggestions in the editor
 * Provides methods to apply, accept, and reject suggestions
 */
export class SuggestionManager {
  private editor: Editor
  private pendingSuggestions: Map<string, SuggestionState> = new Map()

  constructor(editor: Editor) {
    this.editor = editor
  }

  /**
   * Apply an AI edit suggestion to the editor as pending changes
   * Creates deletion marks on original content and addition marks on new content
   */
  applySuggestion(suggestion: AIEditSuggestion): boolean {
    const { suggestionId, operations } = suggestion

    // Store the suggestion state
    this.pendingSuggestions.set(suggestionId, {
      suggestionId,
      status: 'pending',
      operations,
    })

    let success = true

    for (const op of operations) {
      switch (op.type) {
        case 'replace':
          success = this.applyReplace(suggestionId, op) && success
          break
        case 'insert_before':
          success = this.applyInsertBefore(suggestionId, op) && success
          break
        case 'insert_after':
          success = this.applyInsertAfter(suggestionId, op) && success
          break
        case 'delete':
          success = this.applyDelete(suggestionId, op) && success
          break
      }
    }

    return success
  }

  /**
   * Accept a pending suggestion - removes marks and commits changes
   */
  acceptSuggestion(suggestionId: string): boolean {
    const suggestion = this.pendingSuggestions.get(suggestionId)
    if (!suggestion || suggestion.status !== 'pending') return false

    const { tr, state } = this.editor.view
    const deletionType = state.schema.marks.aiDeletion
    const additionType = state.schema.marks.aiAddition

    // Collect all positions to modify (in reverse order to maintain positions)
    const deletions: Array<{ from: number; to: number }> = []

    state.doc.descendants((node, pos) => {
      if (!node.isText) return

      node.marks.forEach((mark) => {
        if (mark.attrs.suggestionId !== suggestionId) return

        if (mark.type === deletionType) {
          // Mark content for deletion
          deletions.push({ from: pos, to: pos + node.nodeSize })
        } else if (mark.type === additionType) {
          // Remove the addition mark but keep content
          tr.removeMark(pos, pos + node.nodeSize, additionType)
        }
      })
    })

    // Delete marked content in reverse order to maintain positions
    deletions
      .sort((a, b) => b.from - a.from)
      .forEach(({ from, to }) => {
        tr.delete(from, to)
      })

    this.editor.view.dispatch(tr)

    // Update suggestion state
    suggestion.status = 'accepted'
    this.pendingSuggestions.set(suggestionId, suggestion)

    return true
  }

  /**
   * Reject a pending suggestion - removes marks and reverts changes
   */
  rejectSuggestion(suggestionId: string): boolean {
    const suggestion = this.pendingSuggestions.get(suggestionId)
    if (!suggestion || suggestion.status !== 'pending') return false

    const { tr, state } = this.editor.view
    const deletionType = state.schema.marks.aiDeletion
    const additionType = state.schema.marks.aiAddition

    // Collect additions to remove (in reverse order)
    const additions: Array<{ from: number; to: number }> = []

    state.doc.descendants((node, pos) => {
      if (!node.isText) return

      node.marks.forEach((mark) => {
        if (mark.attrs.suggestionId !== suggestionId) return

        if (mark.type === additionType) {
          // Mark addition for removal
          additions.push({ from: pos, to: pos + node.nodeSize })
        } else if (mark.type === deletionType) {
          // Remove the deletion mark but keep content
          tr.removeMark(pos, pos + node.nodeSize, deletionType)
        }
      })
    })

    // Remove additions in reverse order
    additions
      .sort((a, b) => b.from - a.from)
      .forEach(({ from, to }) => {
        tr.delete(from, to)
      })

    this.editor.view.dispatch(tr)

    // Update suggestion state
    suggestion.status = 'rejected'
    this.pendingSuggestions.set(suggestionId, suggestion)

    return true
  }

  /**
   * Accept all pending suggestions
   */
  acceptAll(): void {
    for (const [suggestionId, state] of this.pendingSuggestions) {
      if (state.status === 'pending') {
        this.acceptSuggestion(suggestionId)
      }
    }
  }

  /**
   * Reject all pending suggestions
   */
  rejectAll(): void {
    for (const [suggestionId, state] of this.pendingSuggestions) {
      if (state.status === 'pending') {
        this.rejectSuggestion(suggestionId)
      }
    }
  }

  /**
   * Get all pending suggestion IDs
   */
  getPendingSuggestions(): string[] {
    return Array.from(this.pendingSuggestions.entries())
      .filter(([, state]) => state.status === 'pending')
      .map(([id]) => id)
  }

  /**
   * Check if there are any pending suggestions
   */
  hasPendingSuggestions(): boolean {
    return this.getPendingSuggestions().length > 0
  }

  /**
   * Clear all suggestion state
   */
  clear(): void {
    this.pendingSuggestions.clear()
  }

  // -------------------------------------------------------------------------
  // Private Methods
  // -------------------------------------------------------------------------

  private applyReplace(
    suggestionId: string,
    op: { type: 'replace'; blockId: string; newContent: string }
  ): boolean {
    const anchor = findContextAnchorById(this.editor, op.blockId)
    if (!anchor) return false

    const { from, to } = anchor

    // Mark existing content as deletion
    this.editor
      .chain()
      .setTextSelection({ from, to })
      .setAIDeletion({ suggestionId })
      .run()

    // Insert new content after the deletion with addition mark
    this.editor
      .chain()
      .setTextSelection(to)
      .insertContent({
        type: 'text',
        text: op.newContent,
        marks: [{ type: 'aiAddition', attrs: { suggestionId } }],
      })
      .run()

    return true
  }

  private applyInsertBefore(
    suggestionId: string,
    op: { type: 'insert_before'; blockId: string; content: string }
  ): boolean {
    const anchor = findContextAnchorById(this.editor, op.blockId)
    if (!anchor) return false

    // Insert before the anchor with addition mark
    this.editor
      .chain()
      .setTextSelection(anchor.from)
      .insertContent({
        type: 'text',
        text: op.content,
        marks: [{ type: 'aiAddition', attrs: { suggestionId } }],
      })
      .run()

    return true
  }

  private applyInsertAfter(
    suggestionId: string,
    op: { type: 'insert_after'; blockId: string; content: string }
  ): boolean {
    const anchor = findContextAnchorById(this.editor, op.blockId)
    if (!anchor) return false

    // Insert after the anchor with addition mark
    this.editor
      .chain()
      .setTextSelection(anchor.to)
      .insertContent({
        type: 'text',
        text: op.content,
        marks: [{ type: 'aiAddition', attrs: { suggestionId } }],
      })
      .run()

    return true
  }

  private applyDelete(
    suggestionId: string,
    op: { type: 'delete'; blockId: string }
  ): boolean {
    const anchor = findContextAnchorById(this.editor, op.blockId)
    if (!anchor) return false

    // Mark content as deletion
    this.editor
      .chain()
      .setTextSelection({ from: anchor.from, to: anchor.to })
      .setAIDeletion({ suggestionId })
      .run()

    return true
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a suggestion manager instance for an editor
 */
export function createSuggestionManager(editor: Editor): SuggestionManager {
  return new SuggestionManager(editor)
}
