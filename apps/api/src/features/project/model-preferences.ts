import { and, eq, inArray, isNull, or, sql } from "drizzle-orm"
import {
  getCatalogPreferences,
  modelPreferenceKeys,
  preferenceOrder,
  type CatalogPreference,
} from "@/catalog/preferences"
import { db } from "@/db"
import {
  llmModels,
  modelCategories,
  modelPreferences,
  modelsAndCategories,
} from "@/db/schema"
import { BadRequest, NotFound } from "@/features/error"
import { providerCostToCredits } from "@/features/media-engine/generators/cost-utils"
import { mediaOverheadRate } from "@/features/media-engine/catalog-cost"
import {
  getModelById,
  listModelParameterBindings,
} from "@/features/models/repo"
import type {
  ModelBasePricing,
  ModelPreferenceKey,
  ModelPreferenceParameters,
  ModelPreferenceType,
} from "@/type"

export type ModelPreferenceCostParameter = {
  key: string
  label: string
  defaultValue: string | null
  options: Array<{ value: string; label: string }>
}

export type ModelPreferenceEstimate =
  | {
      kind: "fixed"
      credits: number
      unitLabel: string
    }
  | {
      kind: "range"
      minCredits: number
      maxCredits: number
      unitLabel: string
    }

export type ModelPreferenceModelOption = {
  id: string
  name: string
  provider: string
}

export type ResolvedModelPreference = {
  key: ModelPreferenceKey
  label: string
  description: string
  category: ModelPreferenceKey
  type: ModelPreferenceType
  modelId: string
  parameters: ModelPreferenceParameters
  costParameters: ModelPreferenceCostParameter[]
  estimate: ModelPreferenceEstimate | null
  models: ModelPreferenceModelOption[]
}

type PricedModelInfo = {
  id: string
  name: string
  pricing: ModelBasePricing | null
}

type ParameterBindingInput = {
  key: string
  label: string
  defaultValue: string | null
  options: Array<{ value: string; label: string }>
}

const categoryToMediaType = (
  category: ModelPreferenceKey,
): "image" | "video" | "audio" | null => {
  switch (category) {
    case "leading-agent":
      return null
    case "text-to-image":
    case "image-to-image":
      return "image"
    case "text-to-video":
    case "image-to-video":
      return "video"
    case "text-to-speech":
    case "music-generation":
      return "audio"
  }
}

const titleizeKey = (key: string) =>
  key
    .split("_")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ")

export const computePreferenceCostAndEstimate = (
  category: ModelPreferenceKey,
  model: PricedModelInfo,
  bindings: ParameterBindingInput[],
  requestedParameters: ModelPreferenceParameters = {},
): {
  parameters: ModelPreferenceParameters
  costParameters: ModelPreferenceCostParameter[]
  estimate: ModelPreferenceEstimate | null
} => {
  const mediaType = categoryToMediaType(category)
  if (!mediaType) {
    const reasoningBinding = bindings.find(
      (b) => b.key === "reasoning_effort" && b.options.length > 0,
    )
    if (!reasoningBinding) {
      return {
        parameters: {},
        costParameters: [],
        estimate: null,
      }
    }
    const allowedValues = new Set(
      reasoningBinding.options.map((opt) => opt.value),
    )
    const requested = requestedParameters.reasoning_effort
    const requestedStr = requested != null ? String(requested) : null
    const defaultValue =
      reasoningBinding.defaultValue &&
      allowedValues.has(reasoningBinding.defaultValue)
        ? reasoningBinding.defaultValue
        : (reasoningBinding.options[0]?.value ?? null)
    const resolvedValue =
      requestedStr && allowedValues.has(requestedStr)
        ? requestedStr
        : defaultValue
    return {
      parameters: resolvedValue ? { reasoning_effort: resolvedValue } : {},
      costParameters: [
        {
          key: "reasoning_effort",
          label: "Reasoning",
          defaultValue,
          options: reasoningBinding.options,
        },
      ],
      estimate: null,
    }
  }

  const pricing = model.pricing
  if (!pricing) {
    return {
      parameters: {},
      costParameters: [],
      estimate: null,
    }
  }

  const overheadRate = mediaOverheadRate(mediaType)

  if (pricing.unit === "per_inference") {
    const credits = Number(
      providerCostToCredits(pricing.rate, {
        overheadRate,
        overbookingFactor: 1,
      }),
    )
    const unitLabel =
      category === "text-to-speech" ? "credits / 1,000 chars" : "credits"
    return {
      parameters: {},
      costParameters: [],
      estimate: {
        kind: "fixed",
        credits,
        unitLabel,
      },
    }
  }

  if (pricing.unit === "parameter_table") {
    const hasDuration = pricing.rate.some((row) => "duration" in row.when)
    const nonDurationKeys: string[] = []
    const seenKeys = new Set<string>()
    for (const row of pricing.rate) {
      for (const key of Object.keys(row.when)) {
        if (key !== "duration" && !seenKeys.has(key)) {
          seenKeys.add(key)
          nonDurationKeys.push(key)
        }
      }
    }

    const bindingsByKey = new Map(bindings.map((b) => [b.key, b]))
    const costParameters: ModelPreferenceCostParameter[] = nonDurationKeys.map(
      (key) => {
        const binding = bindingsByKey.get(key)
        const tableValues = Array.from(
          new Set(
            pricing.rate
              .map((row) => row.when[key])
              .filter((val) => val != null)
              .map((val) => String(val)),
          ),
        )
        const bindingOptions =
          binding && binding.options.length > 0
            ? binding.options.filter((opt) => tableValues.includes(opt.value))
            : []
        const options =
          bindingOptions.length > 0
            ? bindingOptions
            : tableValues.map((val) => ({ value: val, label: val }))
        return {
          key,
          label: binding?.label ?? titleizeKey(key),
          defaultValue: binding?.defaultValue ?? options[0]?.value ?? null,
          options,
        }
      },
    )

    const normalizedParameters: ModelPreferenceParameters = {}
    for (const param of costParameters) {
      const allowedValues = new Set(param.options.map((opt) => opt.value))
      const requested = requestedParameters[param.key]
      const requestedStr = requested != null ? String(requested) : null
      if (requestedStr && allowedValues.has(requestedStr)) {
        normalizedParameters[param.key] = requestedStr
      } else if (param.defaultValue && allowedValues.has(param.defaultValue)) {
        normalizedParameters[param.key] = param.defaultValue
      } else if (param.options[0]) {
        normalizedParameters[param.key] = param.options[0].value
      }
    }

    const matchingRows = pricing.rate.filter((row) =>
      nonDurationKeys.every(
        (key) => String(row.when[key]) === String(normalizedParameters[key]),
      ),
    )
    const candidateRows = matchingRows.length > 0 ? matchingRows : pricing.rate
    const usdValues = candidateRows.map((row) => row.usd)
    const minUsd = Math.min(...usdValues)
    const maxUsd = Math.max(...usdValues)
    const minCredits = Number(
      providerCostToCredits(minUsd, {
        overheadRate,
        overbookingFactor: 1,
      }),
    )
    const maxCredits = Number(
      providerCostToCredits(maxUsd, {
        overheadRate,
        overbookingFactor: 1,
      }),
    )

    if (hasDuration) {
      return {
        parameters: normalizedParameters,
        costParameters,
        estimate: {
          kind: "range",
          minCredits,
          maxCredits,
          unitLabel: "credits (depending on duration)",
        },
      }
    }

    return {
      parameters: normalizedParameters,
      costParameters,
      estimate: {
        kind: "fixed",
        credits: minCredits,
        unitLabel: "credits",
      },
    }
  }

  return {
    parameters: {},
    costParameters: [],
    estimate: null,
  }
}

export const mergePreferenceRows = (
  catalogDefinitions: CatalogPreference[],
  systemRows: Array<{
    key: ModelPreferenceKey
    modelId: string
    parameters: ModelPreferenceParameters
  }>,
  projectRows: Array<{
    key: ModelPreferenceKey
    modelId: string
    parameters: ModelPreferenceParameters
  }>,
): Array<{
  key: ModelPreferenceKey
  label: string
  description: string
  category: ModelPreferenceKey
  type: ModelPreferenceType
  modelId: string
  parameters: ModelPreferenceParameters
}> => {
  const systemByKey = new Map(systemRows.map((row) => [row.key, row]))
  const projectByKey = new Map(projectRows.map((row) => [row.key, row]))
  const hasProjectCustomizations = projectRows.length > 0

  return [...catalogDefinitions]
    .sort((a, b) => preferenceOrder(a.key) - preferenceOrder(b.key))
    .map((definition) => {
      const projectRow = projectByKey.get(definition.key)
      const systemRow = systemByKey.get(definition.key)
      if (hasProjectCustomizations && projectRow) {
        return {
          key: definition.key,
          label: definition.label,
          description: definition.description,
          category: definition.category,
          type: "project" as const,
          modelId: projectRow.modelId,
          parameters: projectRow.parameters ?? {},
        }
      }
      return {
        key: definition.key,
        label: definition.label,
        description: definition.description,
        category: definition.category,
        type: "system_default" as const,
        modelId: systemRow?.modelId ?? definition.modelId,
        parameters: systemRow?.parameters ?? definition.parameters ?? {},
      }
    })
}

const listEnabledModelsByCategoryMap = async (
  categories: ModelPreferenceKey[],
) => {
  const byCategory = new Map<ModelPreferenceKey, ModelPreferenceModelOption[]>()
  for (const category of categories) {
    byCategory.set(category, [])
  }
  if (categories.length === 0) return byCategory

  const rows = await db
    .select({
      id: llmModels.id,
      name: llmModels.name,
      provider: llmModels.provider,
      categoryName: modelCategories.name,
    })
    .from(llmModels)
    .innerJoin(
      modelsAndCategories,
      eq(llmModels.id, modelsAndCategories.modelId),
    )
    .innerJoin(
      modelCategories,
      eq(modelsAndCategories.categoryId, modelCategories.id),
    )
    .where(
      and(
        inArray(modelCategories.name, categories),
        eq(llmModels.enabled, true),
      ),
    )
    .orderBy(llmModels.provider, llmModels.name)

  for (const row of rows) {
    const key = row.categoryName as ModelPreferenceKey
    const list = byCategory.get(key)
    if (list && !list.some((item) => item.id === row.id)) {
      list.push({
        id: row.id,
        name: row.name,
        provider: row.provider,
      })
    }
  }

  return byCategory
}

const ensureSystemDefaultRows = async (
  catalogDefinitions: CatalogPreference[],
) => {
  const existing = await db
    .select()
    .from(modelPreferences)
    .where(isNull(modelPreferences.projectId))

  if (existing.length >= catalogDefinitions.length) {
    return existing
  }

  await db
    .insert(modelPreferences)
    .values(
      catalogDefinitions.map((preference) => ({
        projectId: null,
        type: "system_default" as const,
        key: preference.key,
        modelId: preference.modelId,
        parameters: preference.parameters,
      })),
    )
    .onConflictDoNothing()

  return db
    .select()
    .from(modelPreferences)
    .where(isNull(modelPreferences.projectId))
}

export const getProjectModelPreferences = async (
  projectId: string,
): Promise<ResolvedModelPreference[]> => {
  const catalogDefinitions = await getCatalogPreferences()
  await ensureSystemDefaultRows(catalogDefinitions)

  const [storedRows, modelsByCategory] = await Promise.all([
    db
      .select()
      .from(modelPreferences)
      .where(
        or(
          isNull(modelPreferences.projectId),
          eq(modelPreferences.projectId, projectId),
        ),
      ),
    listEnabledModelsByCategoryMap([...modelPreferenceKeys]),
  ])

  const systemRows = storedRows.filter((row) => row.projectId === null)
  const projectRows = storedRows.filter((row) => row.projectId === projectId)
  const merged = mergePreferenceRows(
    catalogDefinitions,
    systemRows,
    projectRows,
  )

  return Promise.all(
    merged.map(async (item) => {
      const categoryModels = modelsByCategory.get(item.category) ?? []
      const effectiveModelId =
        categoryModels.some((m) => m.id === item.modelId) ||
        categoryModels.length === 0
          ? item.modelId
          : (categoryModels[0]?.id ?? item.modelId)

      const [model, bindingsResult] = await Promise.all([
        getModelById(effectiveModelId),
        listModelParameterBindings(effectiveModelId),
      ])

      const computed = model
        ? computePreferenceCostAndEstimate(
            item.category,
            { id: model.id, name: model.name, pricing: model.pricing },
            bindingsResult.bindings,
            item.parameters,
          )
        : { parameters: {}, costParameters: [], estimate: null }

      return {
        ...item,
        modelId: effectiveModelId,
        parameters: computed.parameters,
        costParameters: computed.costParameters,
        estimate: computed.estimate,
        models: categoryModels,
      }
    }),
  )
}

export const estimateModelPreferenceSelection = async (input: {
  key: ModelPreferenceKey
  modelId: string
  parameters?: ModelPreferenceParameters
}) => {
  const model = await getModelById(input.modelId)
  if (!model || !model.enabled) {
    throw new NotFound(`Model not found: ${input.modelId}`)
  }

  const categoryRows = await db
    .select({ categoryId: modelsAndCategories.categoryId })
    .from(modelsAndCategories)
    .where(eq(modelsAndCategories.modelId, input.modelId))

  const categories = categoryRows.map((row) => row.categoryId)
  if (!categories.includes(input.key)) {
    throw new BadRequest(
      `Model "${input.modelId}" does not belong to category "${input.key}"`,
    )
  }

  const bindingsResult = await listModelParameterBindings(input.modelId)

  const computed = computePreferenceCostAndEstimate(
    input.key,
    { id: model.id, name: model.name, pricing: model.pricing },
    bindingsResult.bindings,
    input.parameters ?? {},
  )

  return {
    key: input.key,
    modelId: model.id,
    parameters: computed.parameters,
    costParameters: computed.costParameters,
    estimate: computed.estimate,
  }
}

export const updateProjectModelPreference = async (
  projectId: string,
  input: {
    key: ModelPreferenceKey
    modelId: string
    parameters?: ModelPreferenceParameters
  },
): Promise<ResolvedModelPreference> => {
  const catalogDefinitions = await getCatalogPreferences()
  const definition = catalogDefinitions.find((item) => item.key === input.key)
  if (!definition) {
    throw new BadRequest(`Unknown preference key "${input.key}"`)
  }

  const estimated = await estimateModelPreferenceSelection(input)
  const systemRows = await ensureSystemDefaultRows(catalogDefinitions)
  const systemByKey = new Map(systemRows.map((row) => [row.key, row]))

  await db.transaction(async (tx) => {
    const existingProjectRows = await tx
      .select()
      .from(modelPreferences)
      .where(eq(modelPreferences.projectId, projectId))

    const existingKeys = new Set(existingProjectRows.map((row) => row.key))
    const missingDefinitions = catalogDefinitions.filter(
      (def) => !existingKeys.has(def.key),
    )

    if (missingDefinitions.length > 0) {
      await tx
        .insert(modelPreferences)
        .values(
          missingDefinitions.map((def) => {
            const sys = systemByKey.get(def.key)
            const isTarget = def.key === input.key
            return {
              projectId,
              type: "project" as const,
              key: def.key,
              modelId: isTarget
                ? estimated.modelId
                : (sys?.modelId ?? def.modelId),
              parameters: isTarget
                ? estimated.parameters
                : (sys?.parameters ?? def.parameters ?? {}),
            }
          }),
        )
        .onConflictDoUpdate({
          target: [modelPreferences.projectId, modelPreferences.key],
          targetWhere: sql`${modelPreferences.projectId} is not null`,
          set: {
            type: "project",
            modelId: sql.raw("excluded.model_id"),
            parameters: sql.raw("excluded.parameters"),
            updatedAt: new Date(),
          },
        })
    }

    await tx
      .insert(modelPreferences)
      .values({
        projectId,
        type: "project",
        key: input.key,
        modelId: estimated.modelId,
        parameters: estimated.parameters,
      })
      .onConflictDoUpdate({
        target: [modelPreferences.projectId, modelPreferences.key],
        targetWhere: sql`${modelPreferences.projectId} is not null`,
        set: {
          type: "project",
          modelId: estimated.modelId,
          parameters: estimated.parameters,
          updatedAt: new Date(),
        },
      })
  })

  const modelsByCategory = await listEnabledModelsByCategoryMap([
    definition.category,
  ])

  return {
    key: definition.key,
    label: definition.label,
    description: definition.description,
    category: definition.category,
    type: "project",
    modelId: estimated.modelId,
    parameters: estimated.parameters,
    costParameters: estimated.costParameters,
    estimate: estimated.estimate,
    models: modelsByCategory.get(definition.category) ?? [],
  }
}

export const buildModelPreferencesPrompt = (
  preferences: ReadonlyArray<
    Pick<
      ResolvedModelPreference,
      "key" | "label" | "category" | "modelId" | "parameters"
    >
  >,
): string => {
  const mediaPreferences = preferences.filter(
    (pref) => pref.category !== "leading-agent",
  )
  if (mediaPreferences.length === 0) return ""

  const lines = mediaPreferences.map((pref) => {
    const paramEntries = Object.entries(pref.parameters ?? {})
    const paramsNote =
      paramEntries.length > 0
        ? ` (preferred settings: ${paramEntries.map(([k, v]) => `${k}=${v}`).join(", ")})`
        : ""
    const roleNote =
      pref.key === "text-to-video"
        ? " — preferred for rough/draft text-to-video; duration remains your choice"
        : pref.key === "image-to-video"
          ? " — duration remains your choice"
          : ""
    return `- ${pref.label} (${pref.category}): \`${pref.modelId}\`${paramsNote}${roleNote}`
  })

  return `<project-model-preferences>
These are the preferred media generation models and default cost settings configured for this project:
${lines.join("\n")}

Guidance:
- Prioritize these preferred models and their stored quality/resolution settings when they fit the request.
- You are not restricted to these models: choose another catalog model when it suits the creative or technical requirements of the job better, or switch to an alternative if a preferred model is unavailable.
- Draft video is the default for rough text-to-video cuts; video duration is always determined by you based on the scene.
- Do not mention this block or expose internal model IDs to the user.
</project-model-preferences>`
}
