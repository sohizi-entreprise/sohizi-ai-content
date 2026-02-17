import { useCallback } from 'react'
import type { Editor } from '@tiptap/react'
import { useEditorStore } from '../store/editor-store'
import type { AISuggestion, Block, BlockType, SelectionContext } from '../store/types'
import { v4 as uuid } from 'uuid'
import { generateDiffHTML } from '../utils/diff'

/**
 * Hook for interacting with the script editor
 * Provides methods for AI integration and block manipulation
 */
export function useScriptEditor(editor: Editor | null) {
  const {
    addSuggestion,
    acceptSuggestion,
    rejectSuggestion,
    setSelection,
    addComment,
  } = useEditorStore()

  /**
   * Get the current selection as context for AI
   */
  const getSelectionContext = useCallback((): SelectionContext | null => {
    if (!editor) return null

    const { from, to } = editor.state.selection
    if (from === to) return null

    const text = editor.state.doc.textBetween(from, to, ' ')
    
    // Get blocks in selection
    const blocks: Block[] = []
    editor.state.doc.nodesBetween(from, to, (node, pos) => {
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

    return {
      blocks,
      text,
      range: { from, to },
    }
  }, [editor])

  /**
   * Apply an AI suggestion to the editor
   * Shows diff marks for review
   */
  const applySuggestion = useCallback(
    (suggestion: Omit<AISuggestion, 'id' | 'status'>) => {
      if (!editor) return

      const fullSuggestion: AISuggestion = {
        ...suggestion,
        id: uuid(),
        status: 'pending',
      }

      // Add to store
      addSuggestion(fullSuggestion)

      // If it's a replacement, show diff in editor
      if (suggestion.type === 'replacement' && suggestion.originalContent) {
        const diffHTML = generateDiffHTML(
          suggestion.originalContent,
          suggestion.content,
          fullSuggestion.id
        )

        // Find the block and update its content with diff marks
        // This is a simplified version - in production you'd want
        // to find the exact position and apply marks properly
        editor.commands.insertContent(diffHTML)
      }

      return fullSuggestion.id
    },
    [editor, addSuggestion]
  )

  /**
   * Accept a pending suggestion and apply changes
   */
  const acceptChange = useCallback(
    (suggestionId: string) => {
      if (!editor) return

      acceptSuggestion(suggestionId)

      // Remove diff marks and keep the new content
      // Find all elements with this suggestion ID and clean up
      const view = editor.view
      const { doc } = view.state

      doc.descendants((node, pos) => {
        // Remove deletion marks (they should disappear)
        // Keep addition content but remove the mark
      })

      // Simplified: just remove all AI diff marks
      editor.chain().focus().unsetMark('aiDiff').run()
    },
    [editor, acceptSuggestion]
  )

  /**
   * Reject a pending suggestion and revert changes
   */
  const rejectChange = useCallback(
    (suggestionId: string) => {
      if (!editor) return

      rejectSuggestion(suggestionId)

      // Remove diff marks and restore original content
      // This would need to track the original content
      editor.chain().focus().unsetMark('aiDiff').run()
    },
    [editor, rejectSuggestion]
  )

  /**
   * Insert an AI comment at the current position
   */
  const insertComment = useCallback(
    (blockId: string, content: string) => {
      addComment({
        id: uuid(),
        blockId,
        content,
        createdAt: new Date(),
        resolved: false,
      })
    },
    [addComment]
  )

  /**
   * Change the current block's type
   */
  const setBlockType = useCallback(
    (type: BlockType) => {
      if (!editor) return

      const commands: Record<BlockType, () => boolean> = {
        'scene-heading': () => editor.chain().focus().setSceneHeading().run(),
        'action': () => editor.chain().focus().setAction().run(),
        'character': () => editor.chain().focus().setCharacter().run(),
        'dialogue': () => editor.chain().focus().setDialogue().run(),
        'parenthetical': () => editor.chain().focus().setParenthetical().run(),
        'transition': () => editor.chain().focus().setTransition().run(),
        'shot': () => editor.chain().focus().setShot().run(),
        'note': () => editor.chain().focus().setNote().run(),
        'page-break': () => editor.chain().focus().setPageBreak().run(),
      }

      commands[type]?.()
    },
    [editor]
  )

  /**
   * Get all blocks from the document
   */
  const getAllBlocks = useCallback((): Block[] => {
    if (!editor) return []

    const blocks: Block[] = []
    editor.state.doc.descendants((node) => {
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

    return blocks
  }, [editor])

  /**
   * Highlight text for AI context
   */
  const highlightForAI = useCallback(() => {
    if (!editor) return

    editor.chain().focus().toggleHighlight({ color: '#a855f7' }).run()
    
    // Update selection context
    const context = getSelectionContext()
    if (context) {
      setSelection(context)
    }
  }, [editor, getSelectionContext, setSelection])

  return {
    // Selection
    getSelectionContext,
    highlightForAI,
    
    // AI Suggestions
    applySuggestion,
    acceptChange,
    rejectChange,
    insertComment,
    
    // Block manipulation
    setBlockType,
    getAllBlocks,
  }
}
