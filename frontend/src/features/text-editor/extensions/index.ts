export { SluglineExtension } from './scene-heading'
export { ActionExtension } from './action'
export { SceneExtension } from './scene'
export { SceneDelimiterExtension } from './scene-delimiter'
export { CharacterExtension, CHARACTER_EXTENSIONS, type CharacterExtensionType } from './character'
export { DialogueExtension } from './dialogue'
export { ParentheticalExtension } from './parenthetical'
export { TransitionExtension } from './transition'
export { ShotExtension } from './shot'
export { NoteExtension } from './note'
export { PageBreakExtension } from './page-break'
export { AIDiffExtension, AIAdditionMark, AIDeletionMark } from './ai-diff'
export { SlashCommandExtension } from './slash-command'
export { SynopsisTitleNode, SynopsisDividerNode, SynopsisContentNode, SynopsisSpacerNode } from './synopsis'
export {
  WorldSectionHeadingNode,
  WorldFieldNodes,
  type WorldFieldNodeName,
} from './world'
export {
  CharacterFieldNodes,
  LocationFieldNodes,
  PropFieldNodes,
  AllEntityFieldNodes,
  type CharacterFieldNodeName,
  type LocationFieldNodeName,
  type PropFieldNodeName,
  type EntityFieldNodeName,
} from './entity'
export { SelectionShortcut } from './selection-context'
export { EditorEventBusExtension } from './editor-event-bus'
export { DiffStoreExtension } from './diff-store'
export { SpeechExtension } from './speech'

// Context anchor for AI editing
export { ContextAnchorMark, findContextAnchorById, getAllContextAnchors } from './context-anchor'
export type { ContextAnchorOptions } from './context-anchor'

// Suggestion manager for accept/reject AI changes
export { SuggestionManager, createSuggestionManager } from './suggestion-manager'
export type { AIEditOperation, AIEditSuggestion, SuggestionState } from './suggestion-manager'