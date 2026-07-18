export type TokenPricing = {
  currency: 'USD'
  unit: 'per_1m_tokens'
  basis?: 'request_tokens' | 'billable_tokens'
  input: Array<{ up_to: number | null; rate: number }>
  output: Array<{ up_to: number | null; rate: number }>
  cached_input?: Array<{ up_to: number | null; rate: number }>
}

export type AdminModel = {
  id: string
  provider: string
  name: string
  apiName: string
  pricing: TokenPricing | null
  enabled: boolean
  createdAt: string
  updatedAt: string
  categories: string[]
}

export type AdminCategory = {
  id: string
  name: string
  description: string
}

export type ModelOptionChoice = {
  value: string
  label: string
}

export type AdminOption = {
  id: string
  key: string
  label: string
  description: string | null
  options: ModelOptionChoice[]
  default: string | null
  active: boolean
  provider: string
  createdAt: string
  updatedAt: string
  modelIds: string[]
}

export type CreateModelInput = {
  id: string
  provider: string
  name: string
  apiName: string
  pricing?: TokenPricing | null
  enabled?: boolean
  categoryNames: string[]
}

export type UpdateModelInput = Partial<Omit<CreateModelInput, 'id'>>

export type CreateOptionInput = {
  key: string
  label: string
  description?: string | null
  options: ModelOptionChoice[]
  default?: string | null
  active?: boolean
  provider?: string
  modelIds: string[]
}

export type UpdateOptionInput = Partial<CreateOptionInput>

export type CatalogModel = {
  id: string
  name: string
  provider: string
}

export type CatalogModelOption = {
  id: string
  key: string
  label: string
  description: string | null
  options: ModelOptionChoice[]
  default: string | null
  provider: string
}

export type AdminCommand = {
  id: string
  name: string
  action: string
  isPublic: boolean
  visible: boolean
  projectId: string | null
  createdAt: string
  updatedAt: string
}

export type CreateCommandInput = {
  name: string
  action: string
  visible?: boolean
}

export type UpdateCommandInput = Partial<CreateCommandInput>

export type ContentCategoryType = 'genre' | 'format' | 'audience' | 'platform'

export type AdminContentCategory = {
  id: string
  name: string
  slug: string
  description: string | null
  type: ContentCategoryType
  displayPriority: number
  createdAt: string
  updatedAt: string
}

export type CreateContentCategoryInput = {
  name: string
  slug: string
  type: ContentCategoryType
  description?: string | null
  displayPriority?: number
}

export type UpdateContentCategoryInput = Partial<CreateContentCategoryInput>

export type SkillStatus = 'draft' | 'published'
export type SkillVisibility = 'public' | 'private'

export type AdminSkill = {
  id: string
  name: string
  description: string
  instructions: string
  fileNodeId: string | null
  status: SkillStatus
  visibility: SkillVisibility
  createdAt: string
  updatedAt: string
  categoryIds: string[]
  categories: Array<{ id: string; name: string; slug: string; type: string }>
}

export type CreateSkillInput = {
  name: string
  description: string
  instructions: string
  status?: SkillStatus
  visibility?: SkillVisibility
  categoryIds?: string[]
}

export type UpdateSkillInput = Partial<CreateSkillInput>
