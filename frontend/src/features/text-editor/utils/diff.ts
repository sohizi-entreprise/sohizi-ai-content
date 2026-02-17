import { diffChars, diffWords, Change } from 'diff'
import { v4 as uuid } from 'uuid'
import type { AISuggestion, DiffChange } from '../store/types'

export type DiffResult = {
  changes: DiffChange[]
  additions: string[]
  deletions: string[]
  hasChanges: boolean
}

/**
 * Compare two strings and return the differences
 */
export function computeDiff(
  oldContent: string,
  newContent: string,
  options: { granularity?: 'char' | 'word' } = {}
): DiffResult {
  const { granularity = 'word' } = options

  const diffFn = granularity === 'char' ? diffChars : diffWords
  const differences = diffFn(oldContent, newContent)

  const changes: DiffChange[] = []
  const additions: string[] = []
  const deletions: string[] = []

  let position = 0

  differences.forEach((part: Change) => {
    const length = part.value.length

    if (part.added) {
      additions.push(part.value)
      changes.push({
        id: uuid(),
        blockId: '', // Will be set by caller
        type: 'addition',
        oldContent: '',
        newContent: part.value,
        position: { from: position, to: position + length },
      })
    } else if (part.removed) {
      deletions.push(part.value)
      changes.push({
        id: uuid(),
        blockId: '', // Will be set by caller
        type: 'deletion',
        oldContent: part.value,
        newContent: '',
        position: { from: position, to: position + length },
      })
      // Don't advance position for deletions (they're removed)
      return
    }

    position += length
  })

  return {
    changes,
    additions,
    deletions,
    hasChanges: changes.length > 0,
  }
}

/**
 * Convert AI suggestion to diff changes
 */
export function suggestionToDiff(suggestion: AISuggestion): DiffChange[] {
  if (suggestion.type === 'comment') {
    return []
  }

  const changes: DiffChange[] = []

  switch (suggestion.type) {
    case 'replacement':
      if (suggestion.originalContent) {
        // First mark deletion
        changes.push({
          id: uuid(),
          blockId: suggestion.blockId,
          type: 'deletion',
          oldContent: suggestion.originalContent,
          newContent: '',
          position: { from: 0, to: suggestion.originalContent.length },
        })
      }
      // Then mark addition
      changes.push({
        id: uuid(),
        blockId: suggestion.blockId,
        type: 'addition',
        oldContent: '',
        newContent: suggestion.content,
        position: { from: 0, to: suggestion.content.length },
      })
      break

    case 'insertion':
      changes.push({
        id: uuid(),
        blockId: suggestion.blockId,
        type: 'addition',
        oldContent: '',
        newContent: suggestion.content,
        position: { from: 0, to: suggestion.content.length },
      })
      break

    case 'deletion':
      changes.push({
        id: uuid(),
        blockId: suggestion.blockId,
        type: 'deletion',
        oldContent: suggestion.originalContent || suggestion.content,
        newContent: '',
        position: { from: 0, to: (suggestion.originalContent || suggestion.content).length },
      })
      break
  }

  return changes
}

/**
 * Generate HTML with diff marks for display
 */
export function generateDiffHTML(
  oldContent: string,
  newContent: string,
  suggestionId: string
): string {
  const differences = diffWords(oldContent, newContent)
  let html = ''

  differences.forEach((part: Change) => {
    if (part.added) {
      html += `<span data-ai-diff="addition" data-suggestion-id="${suggestionId}" class="ai-diff-addition">${escapeHtml(part.value)}</span>`
    } else if (part.removed) {
      html += `<span data-ai-diff="deletion" data-suggestion-id="${suggestionId}" class="ai-diff-deletion">${escapeHtml(part.value)}</span>`
    } else {
      html += escapeHtml(part.value)
    }
  })

  return html
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, (char) => map[char])
}

/**
 * Merge overlapping changes
 */
export function mergeChanges(changes: DiffChange[]): DiffChange[] {
  if (changes.length <= 1) return changes

  const sorted = [...changes].sort((a, b) => a.position.from - b.position.from)
  const merged: DiffChange[] = []

  let current = sorted[0]

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i]

    // Check if changes overlap or are adjacent
    if (next.position.from <= current.position.to && next.type === current.type) {
      // Merge
      current = {
        ...current,
        newContent: current.newContent + next.newContent,
        oldContent: current.oldContent + next.oldContent,
        position: {
          from: current.position.from,
          to: Math.max(current.position.to, next.position.to),
        },
      }
    } else {
      merged.push(current)
      current = next
    }
  }

  merged.push(current)
  return merged
}
