import type { Skill } from '@/db/schema'

export type MarketSkillCategory = {
  id: string
  name: string
  slug: string
  type: string
}

export type MarketSkill = Skill & {
  categoryIds: string[]
  categories: MarketSkillCategory[]
}

export type MarketCategory = MarketSkillCategory
