import { db } from '@/db'
import {
  llmModels,
  modelCategories,
  modelsAndCategories,
  modelsOptions,
  modelsOptionsAndModels,
} from '@/db/schema'
import { and, eq, inArray } from 'drizzle-orm'

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

export const listActiveModelOptions = async (modelId: string) => {
  return db
    .select({
      id: modelsOptions.id,
      key: modelsOptions.key,
      label: modelsOptions.label,
      description: modelsOptions.description,
      options: modelsOptions.options,
      default: modelsOptions.default,
      provider: modelsOptions.provider,
    })
    .from(modelsOptions)
    .innerJoin(
      modelsOptionsAndModels,
      and(
        eq(modelsOptions.id, modelsOptionsAndModels.optionId),
        eq(modelsOptionsAndModels.modelId, modelId),
      ),
    )
    .where(eq(modelsOptions.active, true))
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

export const listAllOptions = async () => {
  const rows = await db
    .select({
      id: modelsOptions.id,
      key: modelsOptions.key,
      label: modelsOptions.label,
      description: modelsOptions.description,
      options: modelsOptions.options,
      default: modelsOptions.default,
      active: modelsOptions.active,
      provider: modelsOptions.provider,
      createdAt: modelsOptions.createdAt,
      updatedAt: modelsOptions.updatedAt,
      modelId: modelsOptionsAndModels.modelId,
    })
    .from(modelsOptions)
    .leftJoin(modelsOptionsAndModels, eq(modelsOptions.id, modelsOptionsAndModels.optionId))
    .orderBy(modelsOptions.provider, modelsOptions.key)

  const byId = new Map<
    string,
    {
      id: string
      key: string
      label: string
      description: string | null
      options: (typeof rows)[number]['options']
      default: string | null
      active: boolean
      provider: string
      createdAt: Date
      updatedAt: Date
      modelIds: string[]
    }
  >()

  for (const row of rows) {
    const existing = byId.get(row.id)
    if (!existing) {
      byId.set(row.id, {
        id: row.id,
        key: row.key,
        label: row.label,
        description: row.description,
        options: row.options,
        default: row.default,
        active: row.active,
        provider: row.provider,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        modelIds: row.modelId ? [row.modelId] : [],
      })
      continue
    }
    if (row.modelId && !existing.modelIds.includes(row.modelId)) {
      existing.modelIds.push(row.modelId)
    }
  }

  return [...byId.values()]
}

export const getOptionById = async (id: string) => {
  const result = await db.select().from(modelsOptions).where(eq(modelsOptions.id, id))
  return result[0]
}

export const createOption = async (data: {
  key: string
  label: string
  description?: string | null
  options: { value: string; label: string }[]
  default?: string | null
  active?: boolean
  provider?: string
}) => {
  const [created] = await db
    .insert(modelsOptions)
    .values({
      key: data.key,
      label: data.label,
      description: data.description ?? null,
      options: data.options,
      default: data.default ?? null,
      active: data.active ?? true,
      provider: data.provider ?? 'generic',
    })
    .returning()
  return created
}

export const updateOption = async (
  id: string,
  data: Partial<{
    key: string
    label: string
    description: string | null
    options: { value: string; label: string }[]
    default: string | null
    active: boolean
    provider: string
  }>,
) => {
  const [updated] = await db
    .update(modelsOptions)
    .set(data)
    .where(eq(modelsOptions.id, id))
    .returning()
  return updated
}

export const replaceOptionModels = async (optionId: string, modelIds: string[]) => {
  await db.delete(modelsOptionsAndModels).where(eq(modelsOptionsAndModels.optionId, optionId))
  if (modelIds.length === 0) {
    return
  }
  await db.insert(modelsOptionsAndModels).values(
    modelIds.map((modelId) => ({
      optionId,
      modelId,
    })),
  )
}

export const modelsExist = async (modelIds: string[]) => {
  if (modelIds.length === 0) {
    return true
  }
  const rows = await db
    .select({ id: llmModels.id })
    .from(llmModels)
    .where(inArray(llmModels.id, modelIds))
  return rows.length === modelIds.length
}
