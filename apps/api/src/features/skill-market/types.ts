export type MarketSkillCategory = {
  id: string
  name: string
  slug: string
  type: string
}

export type MarketSkill = {
  id: string
  fileNodeId: string
  name: string
  description: string
  instructions: string
  status: "draft" | "published"
  visibility: "private" | "public"
  categoryIds: string[]
  categories: MarketSkillCategory[]
}

export type MarketCategory = MarketSkillCategory
