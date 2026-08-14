import { BadRequest, Conflict, NotFound } from '@/features/error'
import * as modelsRepo from '../models/repo'
import * as commandRepo from '../command/repo'
import * as contentCategoriesRepo from '../content-categories/repo'
import * as skillsRepo from '../skills/repo'
import type {
  createModelSchema,
  createParameterSchema,
  replaceCategoriesSchema,
  replaceModelParametersSchema,
  updateModelSchema,
  updateParameterSchema,
} from '../models/schema'
import type { createCommandSchema, updateCommandSchema } from '../command/schema'
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
type CreateParameterInput = z.infer<typeof createParameterSchema>
type UpdateParameterInput = z.infer<typeof updateParameterSchema>
type ReplaceModelParametersInput = z.infer<typeof replaceModelParametersSchema>
type CreateCommandInput = z.infer<typeof createCommandSchema>
type UpdateCommandInput = z.infer<typeof updateCommandSchema>
type CreateContentCategoryInput = z.infer<typeof createContentCategorySchema>
type UpdateContentCategoryInput = z.infer<typeof updateContentCategorySchema>
type CreateSkillInput = z.infer<typeof createSkillSchema>
type UpdateSkillInput = z.infer<typeof updateSkillSchema>
type ReplaceSkillCategoriesInput = z.infer<typeof replaceSkillCategoriesSchema>

const isUniqueViolation = (error: unknown) =>
  error instanceof Error &&
  (error.message.includes('unique') || error.message.includes('duplicate key'))

const resolveCategoryIds = async (categoryNames: string[]) => {
  const categories = await modelsRepo.getCategoryIdsByNames(categoryNames)
  if (categories.length !== categoryNames.length) {
    const found = new Set(categories.map((category) => category.name))
    const missing = categoryNames.filter((name) => !found.has(name))
    throw new BadRequest(`Unknown categories: ${missing.join(', ')}`)
  }
  return categories.map((category) => category.id)
}

export const listModels = async () => modelsRepo.listAllModels()

export const listCategories = async () => modelsRepo.listCategories()

export const getModel = async (id: string) => {
  const models = await modelsRepo.listAllModels()
  const model = models.find((item) => item.id === id)
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
    apiName: input.apiName,
    pricing: input.pricing ?? null,
    enabled: input.enabled,
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

export const replaceModelCategories = async (id: string, input: ReplaceCategoriesInput) => {
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
  const parameter = await modelsRepo.getParameterById(id)
  if (!parameter) {
    throw new NotFound('Parameter not found')
  }
  return parameter
}

export const createParameter = async (input: CreateParameterInput) => {
  try {
    return await modelsRepo.createParameter({
      key: input.key,
      label: input.label,
      type: input.type,
      description: input.description,
      xUiComponent: input.xUiComponent,
    })
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Conflict('Parameter with this key already exists')
    }
    throw error
  }
}

export const updateParameter = async (id: string, input: UpdateParameterInput) => {
  const existing = await modelsRepo.getParameterById(id)
  if (!existing) {
    throw new NotFound('Parameter not found')
  }

  if (Object.keys(input).length === 0) {
    return existing
  }

  try {
    const updated = await modelsRepo.updateParameter(id, input)
    if (!updated) {
      throw new NotFound('Parameter not found')
    }
    return updated
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Conflict('Parameter with this key already exists')
    }
    throw error
  }
}

export const deleteParameter = async (id: string) => {
  const existing = await modelsRepo.getParameterById(id)
  if (!existing) {
    throw new NotFound('Parameter not found')
  }
  await modelsRepo.deleteParameter(id)
  return { ok: true as const }
}

export const listModelParameters = async (id: string) => {
  const existing = await modelsRepo.getModelById(id)
  if (!existing) {
    throw new NotFound('Model not found')
  }
  return modelsRepo.listModelParameterBindings(id)
}

export const replaceModelParameters = async (id: string, input: ReplaceModelParametersInput) => {
  const existing = await modelsRepo.getModelById(id)
  if (!existing) {
    throw new NotFound('Model not found')
  }
  const parameterIds = input.map((binding) => binding.parameterId)
  if (!(await modelsRepo.parametersExist(parameterIds))) {
    throw new BadRequest('One or more parameterIds do not exist')
  }
  const uniqueIds = new Set(parameterIds)
  if (uniqueIds.size !== parameterIds.length) {
    throw new BadRequest('Duplicate parameterIds are not allowed')
  }
  await modelsRepo.replaceModelParameters(id, input)
  return modelsRepo.listModelParameterBindings(id)
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

export const listContentCategories = async () => contentCategoriesRepo.listAllContentCategories()

export const getContentCategory = async (id: string) => {
  const category = await contentCategoriesRepo.getContentCategoryById(id)
  if (!category) {
    throw new NotFound('Content category not found')
  }
  return category
}

export const createContentCategory = async (input: CreateContentCategoryInput) => {
  try {
    return await contentCategoriesRepo.createContentCategory(input)
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Conflict('Category with this slug already exists')
    }
    throw error
  }
}

export const updateContentCategory = async (id: string, input: UpdateContentCategoryInput) => {
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
  if (!(await contentCategoriesRepo.contentCategoriesExist(input.categoryIds))) {
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

export const replaceSkillCategories = async (id: string, input: ReplaceSkillCategoriesInput) => {
  const existing = await skillsRepo.getSkillById(id)
  if (!existing) {
    throw new NotFound('Skill not found')
  }
  if (!(await contentCategoriesRepo.contentCategoriesExist(input.categoryIds))) {
    throw new BadRequest('One or more categoryIds do not exist')
  }
  await skillsRepo.replaceSkillCategories(id, input.categoryIds)
  return getSkill(id)
}
