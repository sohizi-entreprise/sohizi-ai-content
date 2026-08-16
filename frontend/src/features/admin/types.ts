export type TokenPricing = {
  currency: 'USD'
  unit: 'per_1m_tokens'
  basis?: 'request_tokens' | 'billable_tokens'
  input: Array<{ up_to: number | null; rate: number }>
  output: Array<{ up_to: number | null; rate: number }>
  cached_input?: Array<{ up_to: number | null; rate: number }>
}

export type AdminModelVendor = {
  vendorId: string
  name: string
  apiName: string
  pricing: TokenPricing | null
  enabled: boolean
}

export type AdminModel = {
  id: string
  provider: string
  name: string
  enabled: boolean
  createdAt: string
  updatedAt: string
  categories: string[]
  vendorCount?: number
  hasPricing?: boolean
}

export type AdminModelDetail = AdminModel & {
  vendors: AdminModelVendor[]
}

export type AdminCategoryOption = {
  id: string
  name: string
  description: string
}

export type AdminCategory = AdminCategoryOption & {
  modelCount: number
}

export type AdminModelsCatalog = {
  models: AdminModel[]
  categories: AdminCategoryOption[]
}

export type CreateCategoryInput = {
  name: string
  description?: string
}

export type ModelParameterDataType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'array<string>'
  | 'array<number>'

export type ModelParameterUIComponent = 'select' | 'slider' | 'uploader'

export type ModelParameterConstraint = {
  min?: number
  max?: number
  step?: number
  fileType?: 'image' | 'video' | 'audio'
}

export type ParameterOptionSummary = {
  id: string
  label: string
  value: string
  description: string | null
}

export type OptionVendorMapping = {
  vendorId: string
  vendorName: string
  vendorOptionValue: string
}

export type ParameterVendorMapping = {
  vendorId: string
  vendorName: string
  vendorParamName: string | null
  vendorDefaultValue: string | null
}

export type AdminParameterOption = ParameterOptionSummary & {
  createdAt: string
  updatedAt: string
  vendorMappings: OptionVendorMapping[]
}

export type AdminParameter = {
  id: string
  key: string
  label: string
  type: ModelParameterDataType
  description: string | null
  xUiComponent: ModelParameterUIComponent | null
  createdAt: string
  updatedAt: string
  optionCount: number
  options: ParameterOptionSummary[]
}

export type AdminParameterDetail = Omit<AdminParameter, 'optionCount' | 'options'> & {
  options: AdminParameterOption[]
  vendorMappings: ParameterVendorMapping[]
}

export type CreateParameterOptionInput = {
  label: string
  value: string
  description?: string | null
}

export type UpdateParameterOptionInput = Partial<CreateParameterOptionInput>

export type CreateParameterInput = {
  key: string
  label: string
  type: ModelParameterDataType
  description?: string | null
  xUiComponent?: ModelParameterUIComponent | null
  options?: CreateParameterOptionInput[]
}

export type UpdateParameterInput = Partial<Omit<CreateParameterInput, 'options'>>

export type ModelParameterBinding = {
  parameterId: string
  key: string
  label: string
  type: ModelParameterDataType
  description: string | null
  xUiComponent: ModelParameterUIComponent | null
  providerParamName: string | null
  required: boolean
  sortOrder: number
  defaultValue: string | null
  constraints: ModelParameterConstraint | null
  options: ParameterOptionSummary[]
}

export type ReplaceModelParameterBinding = {
  parameterId: string
  providerParamName?: string | null
  required?: boolean
  defaultValue?: string | null
  constraints?: ModelParameterConstraint | null
  optionIds?: string[]
  sortOrder?: number
}

export type AdminVendor = {
  id: string
  name: string
  enabled: boolean
  createdAt: string
  updatedAt: string
  modelCount: number
}

export type CreateVendorInput = {
  name: string
  enabled?: boolean
}

export type UpdateVendorInput = Partial<CreateVendorInput>

export type CreateModelVendorBindingInput = {
  vendorId: string
  apiName: string
  pricing?: TokenPricing | null
  enabled?: boolean
}

export type UpdateModelVendorBindingInput = Partial<Omit<CreateModelVendorBindingInput, 'vendorId'>>

export type UpsertVendorOptionMapInput = {
  vendorOptionValue: string
}

export type UpsertVendorParameterMapInput = {
  vendorParamName?: string | null
  vendorDefaultValue?: string | null
}

export type CreateModelInput = {
  id: string
  provider: string
  name: string
  enabled?: boolean
  categoryNames: string[]
}

export type UpdateModelInput = Partial<Omit<CreateModelInput, 'id'>>

export type CatalogModel = {
  id: string
  name: string
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
