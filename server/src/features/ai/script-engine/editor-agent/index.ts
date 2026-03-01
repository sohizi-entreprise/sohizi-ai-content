// Editor Agent - Main coordinating agent for script editing
export { EditorAgent } from './editor-agent'
export type { EditorAgentConfig, EditorStreamData } from './editor-agent'

// Skill Registry
export { skillRegistry, SkillRegistry } from './skill-registry'
export type { SkillDefinition, SkillCatalogEntry, SkillCategory } from './skill-registry'

// Tools
export type { ToolExecutionContext } from './tools'
export {
  loadSkillSchema,
  todoWriteSchema,
  editContentSchema,
} from './tools'

// Prompt
export { buildEditorAgentPrompt } from './prompt'
export type { EditorAgentPromptConfig } from './prompt'

// Types
export * from './types'
