// ============================================================================
// MAIN EXPORTS
// ============================================================================

// Components
export { ScriptEditor, type JSONContent } from './components/script-editor'
export { EditorToolbar } from './components/editor-toolbar'
export { BlockMenu } from './components/block-menu'
export { TextSkeleton } from './components/text-skeleton'

// AI Components
export { DiffOverlay } from './components/ai/diff-overlay'
export { DiffActions, InlineDiffActions } from './components/ai/diff-actions'
export { SuggestionCard } from './components/ai/suggestion-card'

// Hooks
export { useScriptEditor } from './hooks/use-editor'
export { useSelection } from './hooks/use-selection'
export { useAIDiff } from './hooks/use-ai-diff'

// Store
export { useEditorStore } from './store/editor-store'

// Types
export type {
  Block,
  BlockType,
  AISuggestion,
  AIComment,
  DiffChange,
  SelectionContext,
  EditorMode,
  PageInfo,
  EditorState,
  BlockMeta,
} from './store/types'

export { BLOCK_METADATA } from './store/types'

// Extensions (for advanced usage)
export {
  SluglineExtension,
  ActionExtension,
  CharacterExtension,
  DialogueExtension,
  ParentheticalExtension,
  TransitionExtension,
  ShotExtension,
  NoteExtension,
  PageBreakExtension,
  AIDiffExtension,
} from './extensions'

// Utils
export { computeDiff, generateDiffHTML, suggestionToDiff } from './utils/diff'
export { calculatePageBreaks, PAGE_CONFIG, getPageForBlock } from './utils/pagination'
