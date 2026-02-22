/**
 * Skill System Types
 * 
 * Skills are modular prompt/knowledge units that teach an AI agent how to perform specific tasks.
 * They are organized by format to allow easy extension to new content types.
 * 
 * Skills do NOT contain context - context is passed via the user prompt.
 * Skills only contain knowledge and technique instructions.
 */

import type { ProjectFormat } from '@/constants/project'

/**
 * A skill is a function that returns a prompt string.
 * Skills are context-free - they only contain knowledge/technique.
 */
export type Skill = () => string

/**
 * Format-specific skill registry.
 * Each format can have its own implementation of a skill.
 */
export type FormatSkillRegistry = Partial<Record<ProjectFormat, Skill>>

/**
 * Skill with format variants and a default fallback.
 */
export interface FormatAwareSkill {
  /** Default skill used when no format-specific variant exists */
  default: Skill
  /** Format-specific skill variants */
  formats?: FormatSkillRegistry
}

/**
 * Get the appropriate skill for a given format.
 * Falls back to default if no format-specific variant exists.
 */
export function getSkillForFormat(
  skill: FormatAwareSkill,
  format: ProjectFormat
): Skill {
  return skill.formats?.[format] ?? skill.default
}
