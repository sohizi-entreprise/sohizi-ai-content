import { readFileSync } from 'fs'
import { parse } from 'yaml'
import { join } from 'path'

// ============================================================================
// TYPES
// ============================================================================

export type SkillCategory = 'writing' | 'structure' | 'character' | 'review'

export type SkillDefinition = {
  name: string
  description: string
  category: SkillCategory
  content: string
}

export type SkillCatalogEntry = {
  name: string
  description: string
  category: SkillCategory
}

type SkillsFile = {
  skills: SkillDefinition[]
}

// ============================================================================
// SKILL REGISTRY
// ============================================================================

class SkillRegistry {
  private skills: Map<string, SkillDefinition> = new Map()
  private loaded = false

  constructor() {
    this.loadSkills()
  }

  /**
   * Load skills from the YAML file
   */
  private loadSkills(): void {
    if (this.loaded) return

    try {
      const yamlPath = join(__dirname, '../skills.yml')
      const file = readFileSync(yamlPath, 'utf-8')
      const parsed = parse(file) as SkillsFile

      if (!parsed.skills || !Array.isArray(parsed.skills)) {
        throw new Error('Invalid skills.yml format: missing skills array')
      }

      for (const skill of parsed.skills) {
        if (!skill.name || !skill.description || !skill.content) {
          console.warn(`Skipping invalid skill definition: ${JSON.stringify(skill)}`)
          continue
        }
        this.skills.set(skill.name, skill)
      }

      this.loaded = true
      console.log(`[SkillRegistry] Loaded ${this.skills.size} skills from skills.yml`)
    } catch (error) {
      console.error('[SkillRegistry] Failed to load skills.yml:', error)
      throw error
    }
  }

  /**
   * Get the skill catalog for the system prompt (names + descriptions only)
   * This keeps the initial context small
   */
  getCatalog(): SkillCatalogEntry[] {
    return Array.from(this.skills.values()).map((s) => ({
      name: s.name,
      description: s.description,
      category: s.category,
    }))
  }

  /**
   * Get the catalog formatted as a string for the system prompt
   */
  getCatalogAsString(): string {
    const catalog = this.getCatalog()
    const byCategory = new Map<SkillCategory, SkillCatalogEntry[]>()

    for (const entry of catalog) {
      const existing = byCategory.get(entry.category) || []
      existing.push(entry)
      byCategory.set(entry.category, existing)
    }

    let result = '## Available Skills\n\n'

    for (const [category, entries] of byCategory) {
      result += `### ${category.charAt(0).toUpperCase() + category.slice(1)}\n`
      for (const entry of entries) {
        result += `- **${entry.name}**: ${entry.description}\n`
      }
      result += '\n'
    }

    return result
  }

  /**
   * Get the full content of a skill (used by load_skill tool)
   */
  getSkillContent(name: string): string | null {
    const skill = this.skills.get(name)
    return skill?.content ?? null
  }

  /**
   * Get multiple skills' content at once, concatenated
   */
  getSkillsContent(names: string[]): string {
    const contents: string[] = []

    for (const name of names) {
      const content = this.getSkillContent(name)
      if (content) {
        contents.push(`# Skill: ${name}\n\n${content}`)
      }
    }

    return contents.join('\n\n---\n\n')
  }

  /**
   * Check if a skill exists
   */
  hasSkill(name: string): boolean {
    return this.skills.has(name)
  }

  /**
   * Get all skill names
   */
  getSkillNames(): string[] {
    return Array.from(this.skills.keys())
  }

  /**
   * Get skills by category
   */
  getSkillsByCategory(category: SkillCategory): SkillDefinition[] {
    return Array.from(this.skills.values()).filter((s) => s.category === category)
  }

  /**
   * Reload skills from disk (useful for development)
   */
  reload(): void {
    this.skills.clear()
    this.loaded = false
    this.loadSkills()
  }
}

// Export singleton instance
export const skillRegistry = new SkillRegistry()

// Export class for testing
export { SkillRegistry }
