import { useEffect, useCallback, RefObject } from 'react'
import type { Editor } from '@tiptap/react'
import { useChatStore } from '../store/chat-store'
import type { MentionItem, EditorType } from '../types'

type UseEditorBridgeOptions = {
  editorRef?: RefObject<Editor | null>
  editorType: EditorType
  enabled?: boolean
}

type UseEditorBridgeReturn = {
  captureSelection: () => MentionItem | null
  hasSelection: boolean
}

export function useEditorBridge(options: UseEditorBridgeOptions): UseEditorBridgeReturn {
  const { editorRef, editorType, enabled = true } = options
  
  const addSelectionContext = useChatStore((state) => state.addSelectionContext)

  // Check if editor has a selection
  const hasSelection = useCallback((): boolean => {
    const editor = editorRef?.current
    if (!editor) return false
    
    const { from, to } = editor.state.selection
    return from !== to
  }, [editorRef])

  // Capture current selection from editor
  const captureSelection = useCallback((): MentionItem | null => {
    const editor = editorRef?.current
    if (!editor) return null

    const { from, to } = editor.state.selection
    if (from === to) return null

    const selectedText = editor.state.doc.textBetween(from, to, ' ')
    if (!selectedText.trim()) return null

    // Create context item
    const contextItem: MentionItem = {
      id: crypto.randomUUID(),
      display: truncateText(selectedText, 50),
    }

    return contextItem
  }, [editorRef, editorType])

  // Handle Cmd+K keyboard shortcut
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        
        const context = captureSelection()
        if (context) {
          addSelectionContext(context)
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [enabled, captureSelection, addSelectionContext])

  return {
    captureSelection,
    hasSelection: hasSelection(),
  }
}

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
