export type MarketSkillCategory = {
  id: string
  name: string
  slug: string
  type: string
}

export type MarketSkill = {
  id: string
  name: string
  description: string
  instructions: string
  status: 'draft' | 'published'
  visibility: 'public' | 'private'
  fileNodeId: string | null
  createdAt: string
  updatedAt: string
  categoryIds: Array<string>
  categories: Array<MarketSkillCategory>
}

export type InstallSkillResult = {
  fileNodeId: string
  name: string
  mode: 'create' | 'replace'
}

export type NameConflictErrorBody = {
  error: string
  code: 'NAME_CONFLICT'
  existingFileNodeId: string
}
