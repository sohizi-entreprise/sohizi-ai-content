import { db } from '@/db'
import {
  llmModels,
  modelCategories,
  modelParameters,
  modelsAndCategories,
  modelsAndParameters,
} from '@/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
import type { ModelParameterConstraint } from '@/type'

export const listEnabledModelsByCategories = async (categories: string[]) => {
  if (categories.length === 0) {
    return []
  }

  return db
    .select({
      id: llmModels.id,
      name: llmModels.name,
      provider: llmModels.provider,
    })
    .from(llmModels)
    .innerJoin(modelsAndCategories, eq(llmModels.id, modelsAndCategories.modelId))
    .innerJoin(modelCategories, eq(modelsAndCategories.categoryId, modelCategories.id))
    .where(and(inArray(modelCategories.name, categories), eq(llmModels.enabled, true)))
    .groupBy(llmModels.id, llmModels.name, llmModels.provider)
    .limit(50)
}

export const getModelById = async (id: string) => {
  const result = await db.select().from(llmModels).where(eq(llmModels.id, id))
  return result[0]
}

const modelParameterBindingSelect = {
  parameterId: modelParameters.id,
  key: modelParameters.key,
  label: modelParameters.label,
  type: modelParameters.type,
  description: modelParameters.description,
  xUiComponent: modelParameters.xUiComponent,
  providerParamName: modelsAndParameters.providerParamName,
  required: modelsAndParameters.required,
  sortOrder: modelsAndParameters.sortOrder,
  defaultValue: modelsAndParameters.defaultValue,
  constraints: modelsAndParameters.constraints,
  enum: modelsAndParameters.enum,
}

export const listModelParameterBindings = async (modelId: string) => {
  return db
    .select(modelParameterBindingSelect)
    .from(modelsAndParameters)
    .innerJoin(modelParameters, eq(modelsAndParameters.parameterId, modelParameters.id))
    .where(eq(modelsAndParameters.modelId, modelId))
    .orderBy(modelsAndParameters.sortOrder, modelParameters.key)
}

export const listAllModels = async () => {
  const rows = await db
    .select({
      id: llmModels.id,
      provider: llmModels.provider,
      name: llmModels.name,
      apiName: llmModels.apiName,
      pricing: llmModels.pricing,
      enabled: llmModels.enabled,
      createdAt: llmModels.createdAt,
      updatedAt: llmModels.updatedAt,
      categoryName: modelCategories.name,
    })
    .from(llmModels)
    .leftJoin(modelsAndCategories, eq(llmModels.id, modelsAndCategories.modelId))
    .leftJoin(modelCategories, eq(modelsAndCategories.categoryId, modelCategories.id))
    .orderBy(llmModels.provider, llmModels.name)

  const byId = new Map<
    string,
    {
      id: string
      provider: string
      name: string
      apiName: string
      pricing: (typeof rows)[number]['pricing']
      enabled: boolean
      createdAt: Date
      updatedAt: Date
      categories: string[]
    }
  >()

  for (const row of rows) {
    const existing = byId.get(row.id)
    if (!existing) {
      byId.set(row.id, {
        id: row.id,
        provider: row.provider,
        name: row.name,
        apiName: row.apiName,
        pricing: row.pricing,
        enabled: row.enabled,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        categories: row.categoryName ? [row.categoryName] : [],
      })
      continue
    }
    if (row.categoryName && !existing.categories.includes(row.categoryName)) {
      existing.categories.push(row.categoryName)
    }
  }

  return [...byId.values()]
}

export const listCategories = async () => {
  return db
    .select({
      id: modelCategories.id,
      name: modelCategories.name,
      description: modelCategories.description,
    })
    .from(modelCategories)
    .orderBy(modelCategories.name)
}

export const getCategoryIdsByNames = async (names: string[]) => {
  if (names.length === 0) {
    return []
  }
  return db
    .select({ id: modelCategories.id, name: modelCategories.name })
    .from(modelCategories)
    .where(inArray(modelCategories.name, names))
}

export const createModel = async (data: {
  id: string
  provider: string
  name: string
  apiName: string
  pricing?: typeof llmModels.$inferInsert.pricing
  enabled?: boolean
}) => {
  const [created] = await db
    .insert(llmModels)
    .values({
      id: data.id,
      provider: data.provider,
      name: data.name,
      apiName: data.apiName,
      pricing: data.pricing ?? null,
      enabled: data.enabled ?? true,
    })
    .returning()
  return created
}

export const updateModel = async (
  id: string,
  data: Partial<{
    provider: string
    name: string
    apiName: string
    pricing: typeof llmModels.$inferInsert.pricing
    enabled: boolean
  }>,
) => {
  const [updated] = await db
    .update(llmModels)
    .set(data)
    .where(eq(llmModels.id, id))
    .returning()
  return updated
}

export const deleteModel = async (id: string) => {
  await db.delete(llmModels).where(eq(llmModels.id, id))
}

export const replaceModelCategories = async (modelId: string, categoryIds: string[]) => {
  await db.delete(modelsAndCategories).where(eq(modelsAndCategories.modelId, modelId))
  if (categoryIds.length === 0) {
    return
  }
  await db.insert(modelsAndCategories).values(
    categoryIds.map((categoryId) => ({
      modelId,
      categoryId,
    })),
  )
}

export const listAllParameters = async () => {
  return db
    .select({
      id: modelParameters.id,
      key: modelParameters.key,
      label: modelParameters.label,
      type: modelParameters.type,
      description: modelParameters.description,
      xUiComponent: modelParameters.xUiComponent,
      createdAt: modelParameters.createdAt,
      updatedAt: modelParameters.updatedAt,
    })
    .from(modelParameters)
    .orderBy(modelParameters.key)
}

export const getParameterById = async (id: string) => {
  const result = await db.select().from(modelParameters).where(eq(modelParameters.id, id))
  return result[0]
}

export const createParameter = async (data: {
  key: string
  label: string
  type: typeof modelParameters.$inferInsert.type
  description?: string | null
  xUiComponent?: typeof modelParameters.$inferInsert.xUiComponent
}) => {
  const [created] = await db
    .insert(modelParameters)
    .values({
      key: data.key,
      label: data.label,
      type: data.type,
      description: data.description ?? null,
      xUiComponent: data.xUiComponent ?? null,
    })
    .returning()
  return created
}

export const updateParameter = async (
  id: string,
  data: Partial<{
    key: string
    label: string
    type: typeof modelParameters.$inferInsert.type
    description: string | null
    xUiComponent: typeof modelParameters.$inferInsert.xUiComponent
  }>,
) => {
  const [updated] = await db
    .update(modelParameters)
    .set(data)
    .where(eq(modelParameters.id, id))
    .returning()
  return updated
}

export const deleteParameter = async (id: string) => {
  await db.delete(modelParameters).where(eq(modelParameters.id, id))
}

export const replaceModelParameters = async (
  modelId: string,
  bindings: Array<{
    parameterId: string
    providerParamName?: string | null
    required?: boolean
    defaultValue?: string | null
    constraints?: ModelParameterConstraint | null
    enum?: string[] | null
    sortOrder?: number
  }>,
) => {
  await db.delete(modelsAndParameters).where(eq(modelsAndParameters.modelId, modelId))
  if (bindings.length === 0) {
    return
  }
  await db.insert(modelsAndParameters).values(
    bindings.map((binding, index) => ({
      modelId,
      parameterId: binding.parameterId,
      providerParamName: binding.providerParamName ?? null,
      required: binding.required ?? false,
      defaultValue: binding.defaultValue ?? null,
      constraints: binding.constraints ?? null,
      enum: binding.enum ?? null,
      sortOrder: binding.sortOrder ?? index,
    })),
  )
}

export const parametersExist = async (parameterIds: string[]) => {
  if (parameterIds.length === 0) {
    return true
  }
  const uniqueIds = [...new Set(parameterIds)]
  const rows = await db
    .select({ id: modelParameters.id })
    .from(modelParameters)
    .where(inArray(modelParameters.id, uniqueIds))
  return rows.length === uniqueIds.length
}
