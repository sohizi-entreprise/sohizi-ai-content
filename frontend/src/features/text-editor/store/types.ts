// ============================================================================
// BLOCK TYPES
// ============================================================================

export type BlockType =
  | 'scene-heading'   // INT. LOCATION - TIME
  | 'action'          // Description of action
  | 'character'       // Character name (centered, caps)
  | 'parenthetical'   // (emotion/direction)
  | 'dialogue'        // Character speech
  | 'transition'      // CUT TO:, FADE OUT:
  | 'shot'            // Camera direction
  | 'note'            // Writer's note (not in final)
  | 'page-break'      // Manual page break

export type Block = {
  id: string
  type: BlockType
  parentId: string | null
  data: {
    content: string
    [key: string]: unknown
  }
}

// ============================================================================
// AI DIFF TYPES
// ============================================================================

export type DiffType = 'addition' | 'deletion' | 'modification'

export type DiffChange = {
  id: string
  blockId: string
  type: DiffType
  oldContent: string
  newContent: string
  position: { from: number; to: number }
}

export type AISuggestion = {
  id: string
  blockId: string
  type: 'replacement' | 'insertion' | 'deletion' | 'comment'
  content: string
  originalContent?: string
  reason?: string
  status: 'pending' | 'accepted' | 'rejected'
}

export type AIComment = {
  id: string
  blockId: string
  content: string
  createdAt: Date
  resolved: boolean
}

// ============================================================================
// SELECTION CONTEXT
// ============================================================================

export type SelectionContext = {
  blocks: Block[]
  text: string
  range: { from: number; to: number } | null
}

// ============================================================================
// EDITOR STATE
// ============================================================================

export type EditorMode = 'edit' | 'review' | 'readonly'

export type PageInfo = {
  pageNumber: number
  startBlockId: string
  endBlockId: string
  lineCount: number
}

export type EditorState = {
  // Mode
  mode: EditorMode
  
  // Selection
  selection: SelectionContext | null
  
  // AI State
  pendingSuggestions: AISuggestion[]
  comments: AIComment[]
  showDiffs: boolean
  
  // Pagination
  pages: PageInfo[]
  currentPage: number
  
  // UI State
  isBlockMenuOpen: boolean
  blockMenuPosition: { x: number; y: number } | null
  activeBlockId: string | null
}

// ============================================================================
// BLOCK METADATA
// ============================================================================

export type BlockMeta = {
  type: BlockType
  label: string
  shortcut: string
  icon: string
  description: string
  defaultContent: string
  autoFormat?: {
    uppercase?: boolean
    centered?: boolean
    rightAlign?: boolean
    indent?: number
  }
}

export const BLOCK_METADATA: Record<BlockType, BlockMeta> = {
  'scene-heading': {
    type: 'scene-heading',
    label: 'Scene Heading',
    shortcut: '⌘1',
    icon: '🎬',
    description: 'INT./EXT. LOCATION - TIME',
    defaultContent: 'INT. ',
    autoFormat: { uppercase: true },
  },
  'action': {
    type: 'action',
    label: 'Action',
    shortcut: '⌘2',
    icon: '🎭',
    description: 'Describe what happens',
    defaultContent: '',
  },
  'character': {
    type: 'character',
    label: 'Character',
    shortcut: '⌘3',
    icon: '👤',
    description: 'Character name',
    defaultContent: '',
    autoFormat: { uppercase: true, centered: true },
  },
  'parenthetical': {
    type: 'parenthetical',
    label: 'Parenthetical',
    shortcut: '⌘4',
    icon: '💭',
    description: '(emotion or direction)',
    defaultContent: '(',
    autoFormat: { centered: true, indent: 2 },
  },
  'dialogue': {
    type: 'dialogue',
    label: 'Dialogue',
    shortcut: '⌘5',
    icon: '💬',
    description: 'Character speech',
    defaultContent: '',
    autoFormat: { indent: 1 },
  },
  'transition': {
    type: 'transition',
    label: 'Transition',
    shortcut: '⌘6',
    icon: '➡️',
    description: 'CUT TO:, FADE OUT:',
    defaultContent: '',
    autoFormat: { uppercase: true, rightAlign: true },
  },
  'shot': {
    type: 'shot',
    label: 'Shot',
    shortcut: '⌘7',
    icon: '📷',
    description: 'Camera direction',
    defaultContent: '',
    autoFormat: { uppercase: true },
  },
  'note': {
    type: 'note',
    label: 'Note',
    shortcut: '⌘8',
    icon: '📝',
    description: "Writer's note (not in final)",
    defaultContent: '',
  },
  'page-break': {
    type: 'page-break',
    label: 'Page Break',
    shortcut: '⌘9',
    icon: '📄',
    description: 'Manual page break',
    defaultContent: '',
  },
}
