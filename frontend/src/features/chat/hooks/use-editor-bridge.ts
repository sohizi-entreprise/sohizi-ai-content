import { useEffect, useCallback } from 'react'
import type { Editor } from '@tiptap/react'
import { subscribeToSelectionRemoval } from '../store/chat-store'
import type { MentionItem, EditorType } from '../types'


// Helper to truncate text for display
function truncateText(text: string, maxLength: number): string {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= maxLength) return cleaned
  return cleaned.slice(0, maxLength - 3) + '...'
}

// Hook to create context from any content (not just editor selection)
type UseContextCreatorReturn = {
  createSelectionContext: (content: string) => MentionItem
}

export function useContextCreator(editorType: EditorType): UseContextCreatorReturn {
  const createSelectionContext = useCallback(
    (content: string): MentionItem => ({
      id: crypto.randomUUID(),
      display: truncateText(content, 50),
    }),
    [editorType]
  )

  return {
    createSelectionContext,
  }
}

// ============================================================================
// SELECTION SYNC HOOK
// ============================================================================

type UseSelectionSyncOptions = {
  editor: Editor | null
  enabled?: boolean
}

/**
 * Hook to sync selection removal between chat input and editor
 * When a selection is removed from the chat input, the corresponding
 * context anchor mark is removed from the editor
 */
export function useSelectionSync({ editor, enabled = true }: UseSelectionSyncOptions): void {
  useEffect(() => {
    if (!enabled || !editor) return

    // Subscribe to selection removal events
    const unsubscribe = subscribeToSelectionRemoval((anchorId) => {
      // Remove the context anchor mark from the editor
      if (editor.commands.unsetContextAnchor) {
        editor.commands.unsetContextAnchor(anchorId)
      }
    })

    return unsubscribe
  }, [editor, enabled])
}
