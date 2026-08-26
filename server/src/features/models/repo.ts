import { db } from '@/db'
import {
  llmModels,
  llmVendors,
  llmVendorsAndModels,
  llmVendorsAndParameterOptions,
  llmVendorsAndParameters,
  modelCategories,
  modelParameters,
  modelsAndCategories,
  modelsAndParameterOptions,
  modelsAndParameters,
  parameterOptions,
} from '@/db/schema'
import { and, count, eq, inArray, sql } from 'drizzle-orm'
import type { ModelBasePricing, ModelParameterConstraint } from '@/type'

const isCompleteListing = (pricing: ModelBasePricing | null | undefined) => {
  if (!pricing) return false
  if (pricing.unit === 'per_1m_tokens') {
    return Number.isFinite(pricing.input) && Number.isFinite(pricing.output)
  }
  return pricing.unit === 'per_inference' && Number.isFinite(pricing.rate)
}

type ParameterOptionRow = {
  id: string
  label: string
  value: string
  description: string | null
  priceMultiplier?: number | null
}

type OptionVendorMappingRow = {
  vendorId: string
  vendorName: string
  vendorOptionValue: string
}

type ParameterVendorMappingRow = {
  vendorId: string
  vendorName: string
  vendorParamName: string | null
  vendorDefaultValue: string | null
}

type ParameterOptionDetailRow = ParameterOptionRow & {
  createdAt: string
  updatedAt: string
  vendorMappings: OptionVendorMappingRow[]
}

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

export type ResolvedVendorModel = {
  id: string
  provider: string
  name: string
  enabled: boolean
  vendorName: string
  apiName: string
  pricing: ModelBasePricing | null
}

export const getModelWithVendorBinding = async (
  modelId: string,
  vendorName: string,
): Promise<ResolvedVendorModel | null> => {
  const model = await getModelById(modelId)
  if (!model) {
    return null
  }

  const [row] = await db
    .select({
      vendorName: llmVendors.name,
      vendorEnabled: llmVendors.enabled,
      apiName: llmVendorsAndModels.apiName,
      bindingEnabled: llmVendorsAndModels.enabled,
    })
    .from(llmVendorsAndModels)
    .innerJoin(llmVendors, eq(llmVendors.id, llmVendorsAndModels.vendorId))
    .where(and(
      eq(llmVendorsAndModels.modelId, modelId),
      eq(llmVendors.name, vendorName),
    ))
    .limit(1)

  if (!row || !row.vendorEnabled || !row.bindingEnabled) {
    throw new Error(`No enabled ${vendorName} binding for model ${modelId}`)
  }

  return {
    id: model.id,
    provider: model.provider,
    name: model.name,
    enabled: model.enabled,
    vendorName: row.vendorName,
    apiName: row.apiName,
    pricing: model.pricing,
  }
}

export const getModelWithRelations = async (id: string) => {
  const rows = await db
    .select({
      id: llmModels.id,
      provider: llmModels.provider,
      name: llmModels.name,
      description: llmModels.description,
      enabled: llmModels.enabled,
      pricing: llmModels.pricing,
      createdAt: llmModels.createdAt,
      updatedAt: llmModels.updatedAt,
      categoryName: modelCategories.name,
      vendorId: llmVendors.id,
      vendorName: llmVendors.name,
      vendorApiName: llmVendorsAndModels.apiName,
      vendorEnabled: llmVendorsAndModels.enabled,
    })
    .from(llmModels)
    .leftJoin(modelsAndCategories, eq(llmModels.id, modelsAndCategories.modelId))
    .leftJoin(modelCategories, eq(modelsAndCategories.categoryId, modelCategories.id))
    .leftJoin(llmVendorsAndModels, eq(llmVendorsAndModels.modelId, llmModels.id))
    .leftJoin(llmVendors, eq(llmVendors.id, llmVendorsAndModels.vendorId))
    .where(eq(llmModels.id, id))

  if (rows.length === 0) {
    return undefined
  }

  const first = rows[0]
  const categories: string[] = []
  const vendors: Array<{
    vendorId: string
    name: string
    apiName: string
    enabled: boolean
  }> = []
  const seenCategories = new Set<string>()
  const seenVendors = new Set<string>()

  for (const row of rows) {
    if (row.categoryName && !seenCategories.has(row.categoryName)) {
      seenCategories.add(row.categoryName)
      categories.push(row.categoryName)
    }
    if (row.vendorId && !seenVendors.has(row.vendorId)) {
      seenVendors.add(row.vendorId)
      vendors.push({
        vendorId: row.vendorId,
        name: row.vendorName!,
        apiName: row.vendorApiName!,
        enabled: row.vendorEnabled!,
      })
    }
  }

  return {
    id: first.id,
    provider: first.provider,
    name: first.name,
    description: first.description,
    enabled: first.enabled,
    pricing: first.pricing,
    createdAt: first.createdAt,
    updatedAt: first.updatedAt,
    categories,
    vendors,
    vendorCount: vendors.length,
    hasPricing: isCompleteListing(first.pricing),
  }
}

export const listModelParameterBindings = async (modelId: string) => {
  const rows = await db
    .select({
      modelId: llmModels.id,
      parameterId: modelParameters.id,
      key: modelParameters.key,
      label: modelParameters.label,
      type: modelParameters.type,
      description: modelParameters.description,
      xUiComponent: modelParameters.xUiComponent,
      required: modelsAndParameters.required,
      sortOrder: modelsAndParameters.sortOrder,
      defaultValue: modelsAndParameters.defaultValue,
      constraints: modelsAndParameters.constraints,
      optionId: parameterOptions.id,
      optionLabel: parameterOptions.label,
      optionValue: parameterOptions.value,
      optionDescription: parameterOptions.description,
      optionPriceMultiplier: modelsAndParameterOptions.priceMultiplier,
    })
    .from(llmModels)
    .leftJoin(modelsAndParameters, eq(modelsAndParameters.modelId, llmModels.id))
    .leftJoin(modelParameters, eq(modelsAndParameters.parameterId, modelParameters.id))
    .leftJoin(
      modelsAndParameterOptions,
      and(
        eq(modelsAndParameterOptions.modelId, modelsAndParameters.modelId),
        eq(modelsAndParameterOptions.parameterId, modelsAndParameters.parameterId),
      ),
    )
    .leftJoin(
      parameterOptions,
      and(
        eq(parameterOptions.id, modelsAndParameterOptions.optionId),
        eq(parameterOptions.parameterId, modelsAndParameterOptions.parameterId),
      ),
    )
    .where(eq(llmModels.id, modelId))
    .orderBy(modelsAndParameters.sortOrder, modelParameters.key, parameterOptions.label)

  if (rows.length === 0) {
    return { found: false as const, bindings: [] }
  }

  const byParameter = new Map<
    string,
    {
      parameterId: string
      key: string
      label: string
      type: (typeof rows)[number]['type']
      description: string | null
      xUiComponent: (typeof rows)[number]['xUiComponent']
      required: boolean
      sortOrder: number
      defaultValue: string | null
      constraints: (typeof rows)[number]['constraints']
      options: ParameterOptionRow[]
    }
  >()

  for (const row of rows) {
    if (!row.parameterId || !row.key || !row.label || row.required == null || row.sortOrder == null) {
      continue
    }
    let binding = byParameter.get(row.parameterId)
    if (!binding) {
      binding = {
        parameterId: row.parameterId,
        key: row.key,
        label: row.label,
        type: row.type!,
        description: row.description,
        xUiComponent: row.xUiComponent,
        required: row.required,
        sortOrder: row.sortOrder,
        defaultValue: row.defaultValue,
        constraints: row.constraints,
        options: [],
      }
      byParameter.set(row.parameterId, binding)
    }
    if (row.optionId) {
      binding.options.push({
        id: row.optionId,
        label: row.optionLabel!,
        value: row.optionValue!,
        description: row.optionDescription,
        priceMultiplier: row.optionPriceMultiplier,
      })
    }
  }

  return { found: true as const, bindings: [...byParameter.values()] }
}

export const listAllModels = async () => {
  const rows = await db
    .select({
      id: llmModels.id,
      provider: llmModels.provider,
      name: llmModels.name,
      description: llmModels.description,
      enabled: llmModels.enabled,
      pricing: llmModels.pricing,
      createdAt: llmModels.createdAt,
      updatedAt: llmModels.updatedAt,
      categoryName: modelCategories.name,
      vendorId: llmVendorsAndModels.vendorId,
    })
    .from(llmModels)
    .leftJoin(modelsAndCategories, eq(llmModels.id, modelsAndCategories.modelId))
    .leftJoin(modelCategories, eq(modelsAndCategories.categoryId, modelCategories.id))
    .leftJoin(llmVendorsAndModels, eq(llmVendorsAndModels.modelId, llmModels.id))
    .orderBy(llmModels.provider, llmModels.name)

  const byId = new Map<
    string,
    {
      id: string
      provider: string
      name: string
      description: string | null
      enabled: boolean
      pricing: ModelBasePricing | null
      createdAt: Date
      updatedAt: Date
      categories: string[]
      vendorIds: Set<string>
    }
  >()

  for (const row of rows) {
    const existing = byId.get(row.id)
    if (!existing) {
      const vendorIds = new Set<string>()
      if (row.vendorId) vendorIds.add(row.vendorId)
      byId.set(row.id, {
        id: row.id,
        provider: row.provider,
        name: row.name,
        description: row.description,
        enabled: row.enabled,
        pricing: row.pricing,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        categories: row.categoryName ? [row.categoryName] : [],
        vendorIds,
      })
      continue
    }
    if (row.categoryName && !existing.categories.includes(row.categoryName)) {
      existing.categories.push(row.categoryName)
    }
    if (row.vendorId && !existing.vendorIds.has(row.vendorId)) {
      existing.vendorIds.add(row.vendorId)
    }
  }

  return [...byId.values()].map(({ vendorIds, ...model }) => ({
    ...model,
    vendorCount: vendorIds.size,
    hasPricing: isCompleteListing(model.pricing),
  }))
}

export const listCategoryOptions = async () => {
  return db
    .select({
      id: modelCategories.id,
      name: modelCategories.name,
      description: modelCategories.description,
    })
    .from(modelCategories)
    .orderBy(modelCategories.name)
}

export const listCategories = async () => {
  const rows = await db
    .select({
      id: modelCategories.id,
      name: modelCategories.name,
      description: modelCategories.description,
      modelCount: count(modelsAndCategories.modelId),
    })
    .from(modelCategories)
    .leftJoin(modelsAndCategories, eq(modelsAndCategories.categoryId, modelCategories.id))
    .groupBy(modelCategories.id)
    .orderBy(modelCategories.name)

  return rows.map((row) => ({
    ...row,
    modelCount: Number(row.modelCount),
  }))
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

export const getCategoryById = async (id: string) => {
  const result = await db.select().from(modelCategories).where(eq(modelCategories.id, id))
  return result[0]
}

export const createCategory = async (data: { name: string; description: string }) => {
  const [created] = await db
    .insert(modelCategories)
    .values({
      name: data.name,
      description: data.description,
    })
    .returning({
      id: modelCategories.id,
      name: modelCategories.name,
      description: modelCategories.description,
    })
  return { ...created, modelCount: 0 }
}

export const deleteCategory = async (id: string) => {
  await db.delete(modelCategories).where(eq(modelCategories.id, id))
}

export const createModel = async (data: {
  id: string
  provider: string
  name: string
  description?: string | null
  enabled?: boolean
  pricing?: ModelBasePricing | null
}) => {
  const [created] = await db
    .insert(llmModels)
    .values({
      id: data.id,
      provider: data.provider,
      name: data.name,
      description: data.description,
      enabled: data.enabled ?? true,
      pricing: data.pricing ?? null,
    })
    .returning()
  return created
}

export const updateModel = async (
  id: string,
  data: Partial<{
    provider: string
    name: string
    description: string | null
    enabled: boolean
    pricing: ModelBasePricing | null
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
  const rows = await db
    .select({
      id: modelParameters.id,
      key: modelParameters.key,
      label: modelParameters.label,
      type: modelParameters.type,
      description: modelParameters.description,
      xUiComponent: modelParameters.xUiComponent,
      createdAt: modelParameters.createdAt,
      updatedAt: modelParameters.updatedAt,
      optionCount: count(parameterOptions.id),
      options: sql<ParameterOptionRow[]>`
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', ${parameterOptions.id},
              'label', ${parameterOptions.label},
              'value', ${parameterOptions.value},
              'description', ${parameterOptions.description}
            )
            ORDER BY ${parameterOptions.label}
          ) FILTER (WHERE ${parameterOptions.id} IS NOT NULL),
          '[]'::jsonb
        )
      `,
    })
    .from(modelParameters)
    .leftJoin(parameterOptions, eq(parameterOptions.parameterId, modelParameters.id))
    .groupBy(modelParameters.id)
    .orderBy(modelParameters.key)

  return rows.map((row) => ({
    ...row,
    optionCount: Number(row.optionCount),
    options: Array.isArray(row.options) ? row.options : [],
  }))
}

export const getParameterById = async (id: string) => {
  const result = await db.select().from(modelParameters).where(eq(modelParameters.id, id))
  return result[0]
}

export const getParameterDetail = async (id: string) => {
  const [row] = await db
    .select({
      id: modelParameters.id,
      key: modelParameters.key,
      label: modelParameters.label,
      type: modelParameters.type,
      description: modelParameters.description,
      xUiComponent: modelParameters.xUiComponent,
      createdAt: modelParameters.createdAt,
      updatedAt: modelParameters.updatedAt,
      options: sql<ParameterOptionDetailRow[]>`
        coalesce((
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', o.id,
              'label', o.label,
              'value', o.value,
              'description', o.description,
              'createdAt', o.created_at,
              'updatedAt', o.updated_at,
              'vendorMappings', coalesce((
                SELECT jsonb_agg(
                  jsonb_build_object(
                    'vendorId', v.id,
                    'vendorName', v.name,
                    'vendorOptionValue', m.vendor_option_value
                  )
                  ORDER BY v.name
                )
                FROM llm_vendors_and_parameter_options m
                INNER JOIN llm_vendors v ON v.id = m.vendor_id
                WHERE m.parameter_option_id = o.id
              ), '[]'::jsonb)
            )
            ORDER BY o.label
          )
          FROM parameter_options o
          WHERE o.parameter_id = ${id}::uuid
        ), '[]'::jsonb)
      `,
      vendorMappings: sql<ParameterVendorMappingRow[]>`
        coalesce((
          SELECT jsonb_agg(
            jsonb_build_object(
              'vendorId', v.id,
              'vendorName', v.name,
              'vendorParamName', m.vendor_param_name,
              'vendorDefaultValue', m.vendor_default_value
            )
            ORDER BY v.name
          )
          FROM llm_vendors_and_parameters m
          INNER JOIN llm_vendors v ON v.id = m.vendor_id
          WHERE m.parameter_id = ${id}::uuid
        ), '[]'::jsonb)
      `,
    })
    .from(modelParameters)
    .where(eq(modelParameters.id, id))

  if (!row) {
    return row
  }

  return {
    ...row,
    options: Array.isArray(row.options) ? row.options : [],
    vendorMappings: Array.isArray(row.vendorMappings) ? row.vendorMappings : [],
  }
}

export const createParameter = async (data: {
  key: string
  label: string
  type: typeof modelParameters.$inferInsert.type
  description?: string | null
  xUiComponent?: typeof modelParameters.$inferInsert.xUiComponent
  options?: Array<{ label: string; value: string; description?: string | null }>
}) => {
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(modelParameters)
      .values({
        key: data.key,
        label: data.label,
        type: data.type,
        description: data.description ?? null,
        xUiComponent: data.xUiComponent ?? null,
      })
      .returning()

    if (data.options && data.options.length > 0) {
      await tx.insert(parameterOptions).values(
        data.options.map((option) => ({
          parameterId: created.id,
          label: option.label,
          value: option.value,
          description: option.description ?? null,
        })),
      )
    }

    return created
  })
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
  const [deleted] = await db
    .delete(modelParameters)
    .where(eq(modelParameters.id, id))
    .returning({ id: modelParameters.id })
  return deleted
}

export const createParameterOption = async (data: {
  parameterId: string
  label: string
  value: string
  description?: string | null
}) => {
  const [created] = await db
    .insert(parameterOptions)
    .values({
      parameterId: data.parameterId,
      label: data.label,
      value: data.value,
      description: data.description ?? null,
    })
    .returning()
  return created
}

export const updateParameterOption = async (
  parameterId: string,
  optionId: string,
  data: Partial<{
    label: string
    value: string
    description: string | null
  }>,
) => {
  const [updated] = await db
    .update(parameterOptions)
    .set(data)
    .where(and(eq(parameterOptions.id, optionId), eq(parameterOptions.parameterId, parameterId)))
    .returning()
  return updated
}

export const deleteParameterOption = async (parameterId: string, optionId: string) => {
  const [deleted] = await db
    .delete(parameterOptions)
    .where(and(eq(parameterOptions.id, optionId), eq(parameterOptions.parameterId, parameterId)))
    .returning({ id: parameterOptions.id })
  return deleted
}

export const upsertVendorOptionMapping = async (data: {
  parameterId: string
  optionId: string
  vendorId: string
  vendorOptionValue: string
}) => {
  const result = await db.execute(sql`
    INSERT INTO llm_vendors_and_parameter_options (vendor_id, parameter_option_id, vendor_option_value)
    SELECT ${data.vendorId}::uuid, o.id, ${data.vendorOptionValue}
    FROM parameter_options o
    WHERE o.id = ${data.optionId}::uuid
      AND o.parameter_id = ${data.parameterId}::uuid
    ON CONFLICT (vendor_id, parameter_option_id)
    DO UPDATE SET
      vendor_option_value = excluded.vendor_option_value,
      updated_at = now()
    RETURNING vendor_id, parameter_option_id, vendor_option_value
  `)

  return result.rows[0] as
    | { vendor_id: string; parameter_option_id: string; vendor_option_value: string }
    | undefined
}

export const deleteVendorOptionMapping = async (
  parameterId: string,
  optionId: string,
  vendorId: string,
) => {
  const [deleted] = await db
    .delete(llmVendorsAndParameterOptions)
    .where(
      and(
        eq(llmVendorsAndParameterOptions.vendorId, vendorId),
        eq(llmVendorsAndParameterOptions.parameterOptionId, optionId),
        sql`exists (
          select 1 from ${parameterOptions}
          where ${parameterOptions.id} = ${optionId}::uuid
            and ${parameterOptions.parameterId} = ${parameterId}::uuid
        )`,
      ),
    )
    .returning({
      vendorId: llmVendorsAndParameterOptions.vendorId,
      parameterOptionId: llmVendorsAndParameterOptions.parameterOptionId,
    })
  return deleted
}

export const upsertVendorParameterMapping = async (data: {
  parameterId: string
  vendorId: string
  vendorParamName?: string | null
  vendorDefaultValue?: string | null
}) => {
  const [row] = await db
    .insert(llmVendorsAndParameters)
    .values({
      vendorId: data.vendorId,
      parameterId: data.parameterId,
      vendorParamName: data.vendorParamName ?? null,
      vendorDefaultValue: data.vendorDefaultValue ?? null,
    })
    .onConflictDoUpdate({
      target: [llmVendorsAndParameters.vendorId, llmVendorsAndParameters.parameterId],
      set: {
        vendorParamName: data.vendorParamName ?? null,
        vendorDefaultValue: data.vendorDefaultValue ?? null,
      },
    })
    .returning()
  return row
}

export const deleteVendorParameterMapping = async (parameterId: string, vendorId: string) => {
  const [deleted] = await db
    .delete(llmVendorsAndParameters)
    .where(
      and(
        eq(llmVendorsAndParameters.vendorId, vendorId),
        eq(llmVendorsAndParameters.parameterId, parameterId),
      ),
    )
    .returning({
      vendorId: llmVendorsAndParameters.vendorId,
      parameterId: llmVendorsAndParameters.parameterId,
    })
  return deleted
}

export const replaceModelParameters = async (
  modelId: string,
  bindings: Array<{
    parameterId: string
    required?: boolean
    defaultValue?: string | null
    constraints?: ModelParameterConstraint | null
    options?: Array<{ optionId: string; priceMultiplier?: number | null }>
    sortOrder?: number
  }>,
) => {
  return db.transaction(async (tx) => {
    const parameterIds = [...new Set(bindings.map((binding) => binding.parameterId))]
    const optionIds = [
      ...new Set(bindings.flatMap((binding) => (binding.options ?? []).map((option) => option.optionId))),
    ]

    if (parameterIds.length > 0) {
      const ownershipRows = await tx
        .select({
          parameterId: modelParameters.id,
          optionId: parameterOptions.id,
        })
        .from(modelParameters)
        .leftJoin(
          parameterOptions,
          and(
            eq(parameterOptions.parameterId, modelParameters.id),
            optionIds.length > 0 ? inArray(parameterOptions.id, optionIds) : sql`false`,
          ),
        )
        .where(inArray(modelParameters.id, parameterIds))

      const foundParameterIds = new Set(ownershipRows.map((row) => row.parameterId))
      if (foundParameterIds.size !== parameterIds.length) {
        return { error: 'missing-parameters' as const }
      }

      const foundPairs = new Set(
        ownershipRows
          .filter((row) => row.optionId)
          .map((row) => `${row.parameterId}:${row.optionId}`),
      )
      const requestedPairs = bindings.flatMap((binding) =>
        (binding.options ?? []).map((option) => `${binding.parameterId}:${option.optionId}`),
      )
      if (requestedPairs.some((pair) => !foundPairs.has(pair))) {
        return { error: 'invalid-options' as const }
      }
    }

    await tx.delete(modelsAndParameters).where(eq(modelsAndParameters.modelId, modelId))
    if (bindings.length === 0) {
      return { error: null }
    }

    await tx.insert(modelsAndParameters).values(
      bindings.map((binding, index) => ({
        modelId,
        parameterId: binding.parameterId,
        required: binding.required ?? false,
        defaultValue: binding.defaultValue ?? null,
        constraints: binding.constraints ?? null,
        sortOrder: binding.sortOrder ?? index,
      })),
    )

    const optionRows = bindings.flatMap((binding) =>
      (binding.options ?? []).map((option) => ({
        modelId,
        parameterId: binding.parameterId,
        optionId: option.optionId,
        priceMultiplier: option.priceMultiplier ?? null,
      })),
    )
    if (optionRows.length > 0) {
      await tx.insert(modelsAndParameterOptions).values(optionRows)
    }

    return { error: null }
  })
}

export const listVendors = async () => {
  const rows = await db
    .select({
      id: llmVendors.id,
      name: llmVendors.name,
      enabled: llmVendors.enabled,
      createdAt: llmVendors.createdAt,
      updatedAt: llmVendors.updatedAt,
      modelCount: count(llmVendorsAndModels.modelId),
    })
    .from(llmVendors)
    .leftJoin(llmVendorsAndModels, eq(llmVendorsAndModels.vendorId, llmVendors.id))
    .groupBy(llmVendors.id)
    .orderBy(llmVendors.name)

  return rows.map((row) => ({
    ...row,
    modelCount: Number(row.modelCount),
  }))
}

export const createVendor = async (data: { name: string; enabled?: boolean }) => {
  const [created] = await db
    .insert(llmVendors)
    .values({
      name: data.name,
      enabled: data.enabled ?? true,
    })
    .returning()
  return { ...created, modelCount: 0 }
}

export const updateVendor = async (
  id: string,
  data: Partial<{ name: string; enabled: boolean }>,
) => {
  const [updated] = await db
    .update(llmVendors)
    .set(data)
    .where(eq(llmVendors.id, id))
    .returning()
  return updated
}

export const deleteVendor = async (id: string) => {
  const [deleted] = await db
    .delete(llmVendors)
    .where(eq(llmVendors.id, id))
    .returning({ id: llmVendors.id })
  return deleted
}

export const createModelVendorBinding = async (data: {
  modelId: string
  vendorId: string
  apiName: string
  enabled?: boolean
}) => {
  const [created] = await db
    .insert(llmVendorsAndModels)
    .values({
      modelId: data.modelId,
      vendorId: data.vendorId,
      apiName: data.apiName,
      enabled: data.enabled ?? true,
    })
    .returning()
  return created
}

export const updateModelVendorBinding = async (
  modelId: string,
  vendorId: string,
  data: Partial<{
    apiName: string
    enabled: boolean
  }>,
) => {
  const [updated] = await db
    .update(llmVendorsAndModels)
    .set(data)
    .where(
      and(eq(llmVendorsAndModels.modelId, modelId), eq(llmVendorsAndModels.vendorId, vendorId)),
    )
    .returning()
  return updated
}

export const deleteModelVendorBinding = async (modelId: string, vendorId: string) => {
  const [deleted] = await db
    .delete(llmVendorsAndModels)
    .where(
      and(eq(llmVendorsAndModels.modelId, modelId), eq(llmVendorsAndModels.vendorId, vendorId)),
    )
    .returning({
      vendorId: llmVendorsAndModels.vendorId,
      modelId: llmVendorsAndModels.modelId,
    })
  return deleted
}
