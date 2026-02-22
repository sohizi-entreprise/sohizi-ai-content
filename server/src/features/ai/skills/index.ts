/**
 * AI Skills Index
 * 
 * Skills are modular prompt/knowledge units that teach an AI agent
 * how to perform specific tasks. They contain ONLY knowledge and technique -
 * context is passed via the user prompt.
 * 
 * System prompts are composed of: Identity + Skill + Memory Context
 * 
 * Usage:
 * ```typescript
 * import { skills, getSkillForFormat } from '@/features/ai/skills'
 * 
 * // Get format-specific skill
 * const skill = getSkillForFormat(skills.narrativeArc, 'storytime')
 * const prompt = skill()
 * ```
 */

// Types
export * from './types'
export { getSkillForFormat } from './types'

// Skills
export { narrativeArcSkill } from './narrative-arc'
export { synopsisSkill } from './synopsis'
export { outlineSkill } from './outline'
export { characterBibleSkill } from './character-bible'
export { worldBibleSkill } from './world-bible'
export { proseFormatSkill } from './prose-format'
export { sceneWritingSkill } from './scene-writing'
export { scriptReviewSkill } from './script-review'

// Convenience re-exports
import { narrativeArcSkill } from './narrative-arc'
import { synopsisSkill } from './synopsis'
import { outlineSkill } from './outline'
import { characterBibleSkill } from './character-bible'
import { worldBibleSkill } from './world-bible'
import { proseFormatSkill } from './prose-format'
import { sceneWritingSkill } from './scene-writing'
import { scriptReviewSkill } from './script-review'

/**
 * All skills organized by pipeline stage
 */
export const skills = {
  // Stage 1: Concept Development
  narrativeArc: narrativeArcSkill,
  
  // Stage 2: Story Development
  synopsis: synopsisSkill,
  
  // Stage 3: Structure
  outline: outlineSkill,
  
  // Stage 4: World Building
  characterBible: characterBibleSkill,
  worldBible: worldBibleSkill,
  
  // Stage 5: Writing
  proseFormat: proseFormatSkill,
  sceneWriting: sceneWritingSkill,
  
  // Stage 6: Quality Assurance
  scriptReview: scriptReviewSkill,
} as const

export type SkillName = keyof typeof skills

/**
 * Get a skill by name
 */
export function getSkill(name: SkillName) {
  return skills[name]
}
