export type ModelBasePricing =
  | {
      unit: 'per_1m_tokens'
      input: number
      output: number
      cached_input?: number
    }
  | {
      unit: 'per_inference'
      rate: number
    }

export type AdminModelVendor = {
  vendorId: string
  name: string
  apiName: string
  enabled: boolean
  priority: number
}

export type AdminModel = {
  id: string
  provider: string
  name: string
  description: string | null
  enabled: boolean
  pricing?: ModelBasePricing | null
  createdAt: string
  updatedAt: string
  categories: Array<string>
  vendorCount?: number
  hasPricing?: boolean
}

export type AdminModelDetail = AdminModel & {
  vendors: Array<AdminModelVendor>
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
  models: Array<AdminModel>
  categories: Array<AdminCategoryOption>
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
  priceMultiplier?: number | null
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
  vendorMappings: Array<OptionVendorMapping>
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
  options: Array<ParameterOptionSummary>
}

export type AdminParameterDetail = Omit<
  AdminParameter,
  'optionCount' | 'options'
> & {
  options: Array<AdminParameterOption>
  vendorMappings: Array<ParameterVendorMapping>
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
  options?: Array<CreateParameterOptionInput>
}

export type UpdateParameterInput = Partial<
  Omit<CreateParameterInput, 'options'>
>

export type ModelParameterBinding = {
  parameterId: string
  key: string
  label: string
  type: ModelParameterDataType
  description: string | null
  xUiComponent: ModelParameterUIComponent | null
  required: boolean
  sortOrder: number
  defaultValue: string | null
  constraints: ModelParameterConstraint | null
  options: Array<ParameterOptionSummary>
}

export type ReplaceModelParameterBinding = {
  parameterId: string
  required?: boolean
  defaultValue?: string | null
  constraints?: ModelParameterConstraint | null
  options?: Array<{ optionId: string; priceMultiplier?: number | null }>
  sortOrder?: number
}

export type VendorKind = 'media' | 'llm'

export type VendorRateLimit = {
  rpm: number
  burst?: number
  maxConcurrency: number
}

export type VendorCircuitConfig = {
  cooldownMs: number
  probeTtlMs: number
}

export type AdminVendor = {
  id: string
  name: string
  kind: VendorKind
  enabled: boolean
  rateLimit: VendorRateLimit
  circuitConfig: VendorCircuitConfig | null
  createdAt: string
  updatedAt: string
  modelCount: number
}

export type CreateVendorInput = {
  name: string
  kind?: VendorKind
  enabled?: boolean
  rateLimit?: VendorRateLimit
  circuitConfig?: VendorCircuitConfig | null
}

export type UpdateVendorInput = Partial<CreateVendorInput>

export type CreateModelVendorBindingInput = {
  vendorId: string
  apiName: string
  enabled?: boolean
  priority?: number
}

export type UpdateModelVendorBindingInput = Partial<
  Omit<CreateModelVendorBindingInput, 'vendorId'>
>

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
  description?: string | null
  enabled?: boolean
  pricing?: ModelBasePricing | null
  categoryNames: Array<string>
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
  categoryIds: Array<string>
  categories: Array<{ id: string; name: string; slug: string; type: string }>
}

export type CreateSkillInput = {
  name: string
  description: string
  instructions: string
  status?: SkillStatus
  visibility?: SkillVisibility
  categoryIds?: Array<string>
}

export type UpdateSkillInput = Partial<CreateSkillInput>
