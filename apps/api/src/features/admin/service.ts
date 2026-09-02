import { BadRequest, Conflict, NotFound } from '@/features/error'
import {
  isRegisteredMediaVendor,
  listRegisteredMediaVendors,
} from '@/features/media-engine/providers/factory'
import * as modelsRepo from '../models/repo'
import * as commandRepo from '../command/repo'
import * as contentCategoriesRepo from '../content-categories/repo'
import * as skillsRepo from '../skills/repo'
import type {
  createCategorySchema,
  createModelSchema,
  createModelVendorBindingSchema,
  createParameterOptionSchema,
  createParameterSchema,
  createVendorSchema,
  replaceCategoriesSchema,
  replaceModelParametersSchema,
  updateModelSchema,
  updateModelVendorBindingSchema,
  updateParameterOptionSchema,
  updateParameterSchema,
  updateVendorSchema,
  upsertVendorOptionMapSchema,
  upsertVendorParameterMapSchema,
} from '../models/schema'
import type {
  createCommandSchema,
  updateCommandSchema,
} from '../command/schema'
import type {
  createContentCategorySchema,
  updateContentCategorySchema,
} from '../content-categories/schema'
import type {
  createSkillSchema,
  replaceSkillCategoriesSchema,
  updateSkillSchema,
} from '../skills/schema'
import type { z } from 'zod'

type CreateModelInput = z.infer<typeof createModelSchema>
type UpdateModelInput = z.infer<typeof updateModelSchema>
type ReplaceCategoriesInput = z.infer<typeof replaceCategoriesSchema>
type CreateCategoryInput = z.infer<typeof createCategorySchema>
type CreateParameterInput = z.infer<typeof createParameterSchema>
type UpdateParameterInput = z.infer<typeof updateParameterSchema>
type ReplaceModelParametersInput = z.infer<typeof replaceModelParametersSchema>
type CreateParameterOptionInput = z.infer<typeof createParameterOptionSchema>
type UpdateParameterOptionInput = z.infer<typeof updateParameterOptionSchema>
type UpsertVendorOptionMapInput = z.infer<typeof upsertVendorOptionMapSchema>
type UpsertVendorParameterMapInput = z.infer<
  typeof upsertVendorParameterMapSchema
>
type CreateVendorInput = z.infer<typeof createVendorSchema>
type UpdateVendorInput = z.infer<typeof updateVendorSchema>
type CreateModelVendorBindingInput = z.infer<
  typeof createModelVendorBindingSchema
>
type UpdateModelVendorBindingInput = z.infer<
  typeof updateModelVendorBindingSchema
>
type CreateCommandInput = z.infer<typeof createCommandSchema>
type UpdateCommandInput = z.infer<typeof updateCommandSchema>
type CreateContentCategoryInput = z.infer<typeof createContentCategorySchema>
type UpdateContentCategoryInput = z.infer<typeof updateContentCategorySchema>
type CreateSkillInput = z.infer<typeof createSkillSchema>
type UpdateSkillInput = z.infer<typeof updateSkillSchema>
type ReplaceSkillCategoriesInput = z.infer<typeof replaceSkillCategoriesSchema>

const postgresCode = (error: unknown): string | undefined => {
  let current: unknown = error
  while (current && typeof current === 'object') {
    if (
      'code' in current &&
      typeof current.code === 'string' &&
      /^\d{5}$/.test(current.code)
    ) {
      return current.code
    }
    current = 'cause' in current ? current.cause : undefined
  }
  return undefined
}

const errorChainMessage = (error: unknown) => {
  const parts: string[] = []
  let current: unknown = error
  while (current instanceof Error) {
    parts.push(current.message)
    current = current.cause
  }
  return parts.join(' ').toLowerCase()
}

const isUniqueViolation = (error: unknown) => {
  if (postgresCode(error) === '23505') return true
  const message = errorChainMessage(error)
  return (
    message.includes('duplicate key') || message.includes('unique constraint')
  )
}

const isForeignKeyViolation = (error: unknown) => {
  if (postgresCode(error) === '23503') return true
  const message = errorChainMessage(error)
  return (
    message.includes('foreign key') || message.includes('violates foreign key')
  )
}

const resolveCategoryIds = async (categoryNames: string[]) => {
  const categories = await modelsRepo.getCategoryIdsByNames(categoryNames)
  if (categories.length !== categoryNames.length) {
    const found = new Set(categories.map((category) => category.name))
    const missing = categoryNames.filter((name) => !found.has(name))
    throw new BadRequest(`Unknown categories: ${missing.join(', ')}`)
  }
  return categories.map((category) => category.id)
}

export const listModels = async () => {
  const [models, categories] = await Promise.all([
    modelsRepo.listAllModels(),
    modelsRepo.listCategoryOptions(),
  ])
  return { models, categories }
}

export const listCategories = async () => modelsRepo.listCategories()

export const createCategory = async (input: CreateCategoryInput) => {
  try {
    return await modelsRepo.createCategory({
      name: input.name,
      description: input.description,
    })
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Conflict('Category with this name already exists')
    }
    throw error
  }
}

export const deleteCategory = async (id: string) => {
  const existing = await modelsRepo.getCategoryById(id)
  if (!existing) {
    throw new NotFound('Category not found')
  }
  await modelsRepo.deleteCategory(id)
  return { ok: true as const }
}

export const getModel = async (id: string) => {
  const model = await modelsRepo.getModelWithRelations(id)
  if (!model) {
    throw new NotFound('Model not found')
  }
  return model
}

export const createModel = async (input: CreateModelInput) => {
  const existing = await modelsRepo.getModelById(input.id)
  if (existing) {
    throw new Conflict('Model already exists')
  }

  const categoryIds = await resolveCategoryIds(input.categoryNames)
  const created = await modelsRepo.createModel({
    id: input.id,
    provider: input.provider,
    name: input.name,
    description: input.description,
    enabled: input.enabled,
    pricing: input.pricing,
  })
  await modelsRepo.replaceModelCategories(created.id, categoryIds)
  return getModel(created.id)
}

export const updateModel = async (id: string, input: UpdateModelInput) => {
  const existing = await modelsRepo.getModelById(id)
  if (!existing) {
    throw new NotFound('Model not found')
  }

  const { categoryNames, ...fields } = input
  if (Object.keys(fields).length > 0) {
    await modelsRepo.updateModel(id, fields)
  }
  if (categoryNames) {
    const categoryIds = await resolveCategoryIds(categoryNames)
    await modelsRepo.replaceModelCategories(id, categoryIds)
  }
  return getModel(id)
}

export const deleteModel = async (id: string) => {
  const existing = await modelsRepo.getModelById(id)
  if (!existing) {
    throw new NotFound('Model not found')
  }
  await modelsRepo.deleteModel(id)
  return { ok: true as const }
}

export const replaceModelCategories = async (
  id: string,
  input: ReplaceCategoriesInput,
) => {
  const existing = await modelsRepo.getModelById(id)
  if (!existing) {
    throw new NotFound('Model not found')
  }
  const categoryIds = await resolveCategoryIds(input.categoryNames)
  await modelsRepo.replaceModelCategories(id, categoryIds)
  return getModel(id)
}

export const listParameters = async () => modelsRepo.listAllParameters()

export const getParameter = async (id: string) => {
  const parameter = await modelsRepo.getParameterDetail(id)
  if (!parameter) {
    throw new NotFound('Parameter not found')
  }
  return parameter
}

export const createParameter = async (input: CreateParameterInput) => {
  try {
    const created = await modelsRepo.createParameter({
      key: input.key,
      label: input.label,
      type: input.type,
      description: input.description,
      xUiComponent: input.xUiComponent,
      options: input.options,
    })
    return getParameter(created.id)
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Conflict('Parameter with this key already exists')
    }
    throw error
  }
}

export const updateParameter = async (
  id: string,
  input: UpdateParameterInput,
) => {
  if (Object.keys(input).length === 0) {
    return getParameter(id)
  }

  try {
    const updated = await modelsRepo.updateParameter(id, input)
    if (!updated) {
      throw new NotFound('Parameter not found')
    }
    return getParameter(id)
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Conflict('Parameter with this key already exists')
    }
    throw error
  }
}

export const deleteParameter = async (id: string) => {
  const deleted = await modelsRepo.deleteParameter(id)
  if (!deleted) {
    throw new NotFound('Parameter not found')
  }
  return { ok: true as const }
}

export const createParameterOption = async (
  parameterId: string,
  input: CreateParameterOptionInput,
) => {
  const parameter = await modelsRepo.getParameterById(parameterId)
  if (!parameter) {
    throw new NotFound('Parameter not found')
  }
  try {
    return await modelsRepo.createParameterOption({
      parameterId,
      label: input.label,
      value: input.value,
      description: input.description,
    })
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Conflict(
        'Option with this value already exists for the parameter',
      )
    }
    throw error
  }
}

export const updateParameterOption = async (
  parameterId: string,
  optionId: string,
  input: UpdateParameterOptionInput,
) => {
  if (Object.keys(input).length === 0) {
    throw new BadRequest('No fields to update')
  }
  try {
    const updated = await modelsRepo.updateParameterOption(
      parameterId,
      optionId,
      input,
    )
    if (!updated) {
      throw new NotFound('Option not found')
    }
    return updated
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Conflict(
        'Option with this value already exists for the parameter',
      )
    }
    throw error
  }
}

export const deleteParameterOption = async (
  parameterId: string,
  optionId: string,
) => {
  const deleted = await modelsRepo.deleteParameterOption(parameterId, optionId)
  if (!deleted) {
    throw new NotFound('Option not found')
  }
  return { ok: true as const }
}

export const upsertVendorOptionMapping = async (
  parameterId: string,
  optionId: string,
  vendorId: string,
  input: UpsertVendorOptionMapInput,
) => {
  try {
    const mapping = await modelsRepo.upsertVendorOptionMapping({
      parameterId,
      optionId,
      vendorId,
      vendorOptionValue: input.vendorOptionValue,
    })
    if (!mapping) {
      throw new NotFound('Option not found')
    }
    return {
      vendorId: mapping.vendor_id,
      parameterOptionId: mapping.parameter_option_id,
      vendorOptionValue: mapping.vendor_option_value,
    }
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      throw new BadRequest('Vendor does not exist')
    }
    throw error
  }
}

export const deleteVendorOptionMapping = async (
  parameterId: string,
  optionId: string,
  vendorId: string,
) => {
  const deleted = await modelsRepo.deleteVendorOptionMapping(
    parameterId,
    optionId,
    vendorId,
  )
  if (!deleted) {
    throw new NotFound('Vendor option mapping not found')
  }
  return { ok: true as const }
}

export const upsertVendorParameterMapping = async (
  parameterId: string,
  vendorId: string,
  input: UpsertVendorParameterMapInput,
) => {
  const parameter = await modelsRepo.getParameterById(parameterId)
  if (!parameter) {
    throw new NotFound('Parameter not found')
  }
  try {
    return await modelsRepo.upsertVendorParameterMapping({
      parameterId,
      vendorId,
      vendorParamName: input.vendorParamName,
      vendorDefaultValue: input.vendorDefaultValue,
    })
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      throw new BadRequest('Vendor does not exist')
    }
    throw error
  }
}

export const deleteVendorParameterMapping = async (
  parameterId: string,
  vendorId: string,
) => {
  const deleted = await modelsRepo.deleteVendorParameterMapping(
    parameterId,
    vendorId,
  )
  if (!deleted) {
    throw new NotFound('Vendor parameter mapping not found')
  }
  return { ok: true as const }
}

export const listVendors = async () => modelsRepo.listVendors()

export const listMediaVendorSlugs = async () => ({
  slugs: listRegisteredMediaVendors(),
})

export const createVendor = async (input: CreateVendorInput) => {
  if (
    (input.kind ?? 'llm') === 'media' &&
    !isRegisteredMediaVendor(input.name)
  ) {
    throw new BadRequest(`Unknown media vendor slug: ${input.name}`)
  }
  try {
    return await modelsRepo.createVendor({
      name: input.name,
      kind: input.kind,
      enabled: input.enabled,
      rateLimit: input.rateLimit,
      circuitConfig: input.circuitConfig,
    })
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Conflict('Vendor with this name already exists')
    }
    throw error
  }
}

export const updateVendor = async (id: string, input: UpdateVendorInput) => {
  if (Object.keys(input).length === 0) {
    throw new BadRequest('No fields to update')
  }
  if (input.kind === 'media' || input.name) {
    const existing = await modelsRepo
      .listVendors()
      .then((rows) => rows.find((row) => row.id === id))
    const name = input.name ?? existing?.name
    const kind = input.kind ?? existing?.kind
    if (kind === 'media' && name && !isRegisteredMediaVendor(name)) {
      throw new BadRequest(`Unknown media vendor slug: ${name}`)
    }
  }
  try {
    const updated = await modelsRepo.updateVendor(id, input)
    if (!updated) {
      throw new NotFound('Vendor not found')
    }
    return updated
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Conflict('Vendor with this name already exists')
    }
    throw error
  }
}

export const deleteVendor = async (id: string) => {
  const deleted = await modelsRepo.deleteVendor(id)
  if (!deleted) {
    throw new NotFound('Vendor not found')
  }
  return { ok: true as const }
}

export const createModelVendorBinding = async (
  modelId: string,
  input: CreateModelVendorBindingInput,
) => {
  const model = await modelsRepo.getModelById(modelId)
  if (!model) {
    throw new NotFound('Model not found')
  }
  try {
    await modelsRepo.createModelVendorBinding({
      modelId,
      vendorId: input.vendorId,
      apiName: input.apiName,
      enabled: input.enabled,
      priority: input.priority,
    })
    return getModel(modelId)
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Conflict('Vendor is already bound to this model')
    }
    if (isForeignKeyViolation(error)) {
      throw new BadRequest('Vendor does not exist')
    }
    throw error
  }
}

export const updateModelVendorBinding = async (
  modelId: string,
  vendorId: string,
  input: UpdateModelVendorBindingInput,
) => {
  if (Object.keys(input).length === 0) {
    throw new BadRequest('No fields to update')
  }
  const updated = await modelsRepo.updateModelVendorBinding(
    modelId,
    vendorId,
    input,
  )
  if (!updated) {
    throw new NotFound('Vendor binding not found')
  }
  return getModel(modelId)
}

export const deleteModelVendorBinding = async (
  modelId: string,
  vendorId: string,
) => {
  const deleted = await modelsRepo.deleteModelVendorBinding(modelId, vendorId)
  if (!deleted) {
    throw new NotFound('Vendor binding not found')
  }
  return getModel(modelId)
}

export const listModelParameters = async (id: string) => {
  const result = await modelsRepo.listModelParameterBindings(id)
  if (!result.found) {
    throw new NotFound('Model not found')
  }
  return result.bindings
}

export const replaceModelParameters = async (
  id: string,
  input: ReplaceModelParametersInput,
) => {
  const existing = await modelsRepo.getModelById(id)
  if (!existing) {
    throw new NotFound('Model not found')
  }
  const parameterIds = input.map((binding) => binding.parameterId)
  const uniqueIds = new Set(parameterIds)
  if (uniqueIds.size !== parameterIds.length) {
    throw new BadRequest('Duplicate parameterIds are not allowed')
  }
  const result = await modelsRepo.replaceModelParameters(id, input)
  if (result.error === 'missing-parameters') {
    throw new BadRequest('One or more parameterIds do not exist')
  }
  if (result.error === 'invalid-options') {
    throw new BadRequest(
      'One or more options do not belong to the bound parameter',
    )
  }
  const bindings = await modelsRepo.listModelParameterBindings(id)
  return bindings.bindings
}

// ======================== Commands ========================

export const listCommands = async () => commandRepo.listAllCommands()

export const getCommand = async (id: string) => {
  const command = await commandRepo.getCommandById(id)
  if (!command) {
    throw new NotFound('Command not found')
  }
  return command
}

export const createCommand = async (input: CreateCommandInput) => {
  try {
    return await commandRepo.createCommand({
      name: input.name,
      action: input.action,
      visible: input.visible,
    })
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Conflict('Command with this name already exists')
    }
    throw error
  }
}

export const updateCommand = async (id: string, input: UpdateCommandInput) => {
  const existing = await commandRepo.getCommandById(id)
  if (!existing) {
    throw new NotFound('Command not found')
  }

  if (Object.keys(input).length === 0) {
    return existing
  }

  try {
    const updated = await commandRepo.updateCommand(id, input)
    if (!updated) {
      throw new NotFound('Command not found')
    }
    return updated
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Conflict('Command with this name already exists')
    }
    throw error
  }
}

export const deleteCommand = async (id: string) => {
  const existing = await commandRepo.getCommandById(id)
  if (!existing) {
    throw new NotFound('Command not found')
  }
  await commandRepo.deleteCommand(id)
  return { ok: true as const }
}

// ======================== Content categories ========================

export const listContentCategories = async () =>
  contentCategoriesRepo.listAllContentCategories()

export const getContentCategory = async (id: string) => {
  const category = await contentCategoriesRepo.getContentCategoryById(id)
  if (!category) {
    throw new NotFound('Content category not found')
  }
  return category
}

export const createContentCategory = async (
  input: CreateContentCategoryInput,
) => {
  try {
    return await contentCategoriesRepo.createContentCategory(input)
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Conflict('Category with this slug already exists')
    }
    throw error
  }
}

export const updateContentCategory = async (
  id: string,
  input: UpdateContentCategoryInput,
) => {
  const existing = await contentCategoriesRepo.getContentCategoryById(id)
  if (!existing) {
    throw new NotFound('Content category not found')
  }

  if (Object.keys(input).length === 0) {
    return existing
  }

  try {
    const updated = await contentCategoriesRepo.updateContentCategory(id, input)
    if (!updated) {
      throw new NotFound('Content category not found')
    }
    return updated
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Conflict('Category with this slug already exists')
    }
    throw error
  }
}

export const deleteContentCategory = async (id: string) => {
  const existing = await contentCategoriesRepo.getContentCategoryById(id)
  if (!existing) {
    throw new NotFound('Content category not found')
  }
  await contentCategoriesRepo.deleteContentCategory(id)
  return { ok: true as const }
}

// ======================== Skills ========================

export const listSkills = async () => skillsRepo.listAllSkills()

export const getSkill = async (id: string) => {
  const skill = await skillsRepo.getSkillById(id)
  if (!skill) {
    throw new NotFound('Skill not found')
  }
  return skill
}

export const createSkill = async (input: CreateSkillInput) => {
  if (
    !(await contentCategoriesRepo.contentCategoriesExist(input.categoryIds))
  ) {
    throw new BadRequest('One or more categoryIds do not exist')
  }

  const created = await skillsRepo.createSkill({
    name: input.name,
    description: input.description,
    instructions: input.instructions,
    status: input.status,
    visibility: input.visibility,
  })
  await skillsRepo.replaceSkillCategories(created.id, input.categoryIds)
  return getSkill(created.id)
}

export const updateSkill = async (id: string, input: UpdateSkillInput) => {
  const existing = await skillsRepo.getSkillById(id)
  if (!existing) {
    throw new NotFound('Skill not found')
  }

  const { categoryIds, ...fields } = input
  if (Object.keys(fields).length > 0) {
    await skillsRepo.updateSkill(id, fields)
  }
  if (categoryIds) {
    if (!(await contentCategoriesRepo.contentCategoriesExist(categoryIds))) {
      throw new BadRequest('One or more categoryIds do not exist')
    }
    await skillsRepo.replaceSkillCategories(id, categoryIds)
  }
  return getSkill(id)
}

export const deleteSkill = async (id: string) => {
  const existing = await skillsRepo.getSkillById(id)
  if (!existing) {
    throw new NotFound('Skill not found')
  }
  await skillsRepo.deleteSkill(id)
  return { ok: true as const }
}

export const replaceSkillCategories = async (
  id: string,
  input: ReplaceSkillCategoriesInput,
) => {
  const existing = await skillsRepo.getSkillById(id)
  if (!existing) {
    throw new NotFound('Skill not found')
  }
  if (
    !(await contentCategoriesRepo.contentCategoriesExist(input.categoryIds))
  ) {
    throw new BadRequest('One or more categoryIds do not exist')
  }
  await skillsRepo.replaceSkillCategories(id, input.categoryIds)
  return getSkill(id)
}
