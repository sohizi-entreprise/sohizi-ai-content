import { presetOptionIdFromKeyValue } from "./ids"
import { loadCatalog, type Catalog } from "./load"
import modelsTracker from "./models-tracker"

const MODEL_ID_MAX = 50
const NAME_MAX = 50
const API_NAME_MAX = 50

const addDuplicateErrors = (
  errors: string[],
  kind: string,
  ids: Array<{ id: string; source?: string }>,
) => {
  const seen = new Map<string, string>()
  for (const item of ids) {
    if (!item.id) {
      errors.push(`${item.source ?? kind} is missing an id`)
      continue
    }
    const previous = seen.get(item.id)
    if (previous) {
      errors.push(
        `duplicate ${kind} id "${item.id}"` +
          (item.source || previous
            ? ` (${[previous, item.source].filter(Boolean).join(", ")})`
            : ""),
      )
      continue
    }
    seen.set(item.id, item.source ?? kind)
  }
}

export const validateCatalog = (catalog: Catalog): string[] => {
  const errors: string[] = []

  addDuplicateErrors(
    errors,
    "category",
    catalog.categories.map((category) => ({ id: category.id })),
  )
  addDuplicateErrors(
    errors,
    "parameter",
    catalog.parameters.map((parameter) => ({ id: parameter.id })),
  )

  const parameterKeys = new Map<string, string>()
  const optionIds: Array<{ id: string; source: string }> = []
  const parametersById = new Map(
    catalog.parameters.map((parameter) => [parameter.id, parameter]),
  )

  for (const parameter of catalog.parameters) {
    if (parameter.key) {
      const previous = parameterKeys.get(parameter.key)
      if (previous) {
        errors.push(
          `duplicate parameter key "${parameter.key}" (${previous}, ${parameter.id})`,
        )
      } else {
        parameterKeys.set(parameter.key, parameter.id)
      }
    }

    const values = new Set<string>()
    for (const option of parameter.options) {
      optionIds.push({
        id: option.id,
        source: parameter.id,
      })
      if (values.has(option.value)) {
        errors.push(
          `duplicate option value "${option.value}" on ${parameter.id}`,
        )
      }
      values.add(option.value)
    }
  }
  addDuplicateErrors(errors, "option", optionIds)

  addDuplicateErrors(
    errors,
    "model",
    catalog.models.map((model) => ({ id: model.id, source: model.sourceFile })),
  )
  addDuplicateErrors(
    errors,
    "vendor",
    catalog.vendors.map((vendor) => ({
      id: vendor.id,
      source: vendor.sourceFile,
    })),
  )

  const categoryIds = new Set(catalog.categories.map((category) => category.id))
  const modelIds = new Set(catalog.models.map((model) => model.id))
  const boundModels = new Set<string>()

  for (const model of catalog.models) {
    const source = `${model.sourceFile} model "${model.id}"`
    if (model.id.length > MODEL_ID_MAX) {
      errors.push(`${source} id exceeds ${MODEL_ID_MAX} characters`)
    }
    if (model.name.length > NAME_MAX) {
      errors.push(`${source} name exceeds ${NAME_MAX} characters`)
    }
    if (model.provider.length > NAME_MAX) {
      errors.push(`${source} provider exceeds ${NAME_MAX} characters`)
    }
    for (const categoryId of model.categories) {
      if (!categoryIds.has(categoryId)) {
        errors.push(`${source} references unknown category "${categoryId}"`)
      }
    }
    for (const parameter of model.parameters) {
      const defined = parametersById.get(parameter.id)
      if (!defined) {
        errors.push(`${source} references unknown parameter "${parameter.id}"`)
        continue
      }
      const allowed = new Set(defined.options.map((option) => option.value))
      for (const value of parameter.allowedValues ?? []) {
        const normalized = String(value)
        if (!allowed.has(normalized) && !allowed.has(value as string)) {
          errors.push(
            `${source} allowedValues "${normalized}" is not an option of ${parameter.id}`,
          )
        }
      }
    }
  }

  for (const vendor of catalog.vendors) {
    const source = `${vendor.sourceFile} vendor "${vendor.id}"`
    if (!vendor.adapter) {
      errors.push(`${source} is missing an adapter`)
    }
    for (const binding of vendor.models) {
      if (binding.apiName.length > API_NAME_MAX) {
        errors.push(
          `${source} apiName "${binding.apiName}" exceeds ${API_NAME_MAX} characters`,
        )
      }
      if (!modelIds.has(binding.id)) {
        errors.push(`${source} binds unknown model "${binding.id}"`)
        continue
      }
      boundModels.add(binding.id)
    }

    for (const [parameterId, mapping] of Object.entries(
      vendor.parametersMapping,
    )) {
      const parameter = parametersById.get(parameterId)
      if (!parameter) {
        errors.push(`${source} maps unknown parameter "${parameterId}"`)
        continue
      }
      for (const optionId of Object.keys(mapping.optionMapping ?? {})) {
        if (!parameter.options.some((option) => option.id === optionId)) {
          errors.push(
            `${source} maps unknown option "${optionId}" on ${parameterId}`,
          )
        }
      }
    }

    for (const [modelId, overrides] of Object.entries(
      vendor.modelParameterOverrides,
    )) {
      if (!modelIds.has(modelId)) {
        errors.push(`${source} overrides unknown model "${modelId}"`)
      }
      for (const parameterId of Object.keys(overrides)) {
        if (!parametersById.has(parameterId)) {
          errors.push(
            `${source} override on "${modelId}" references unknown parameter "${parameterId}"`,
          )
        }
      }
    }
  }

  for (const model of catalog.models) {
    if (!boundModels.has(model.id)) {
      errors.push(
        `${model.sourceFile} model "${model.id}" is not bound in any vendor file`,
      )
    }
  }

  const presets = catalog.presets ?? []
  addDuplicateErrors(
    errors,
    "preset",
    presets.map((preset) => ({ id: preset.id })),
  )
  const presetKeys = new Map<string, string>()
  const presetOptionIds: Array<{ id: string; source: string }> = []
  for (const preset of presets) {
    if (preset.key) {
      const previous = presetKeys.get(preset.key)
      if (previous) {
        errors.push(
          `duplicate preset key "${preset.key}" (${previous}, ${preset.id})`,
        )
      } else {
        presetKeys.set(preset.key, preset.id)
      }
    }
    const optionValues = new Set<string>()
    for (const option of preset.options) {
      presetOptionIds.push({
        id: presetOptionIdFromKeyValue(preset.key, option.value),
        source: preset.id,
      })
      if (optionValues.has(option.value)) {
        errors.push(
          `duplicate preset option value "${option.value}" on ${preset.id}`,
        )
      }
      optionValues.add(option.value)
    }
  }
  addDuplicateErrors(errors, "preset option", presetOptionIds)

  const commands = catalog.commands ?? []
  addDuplicateErrors(
    errors,
    "command",
    commands.map((command) => ({ id: command.id })),
  )
  const commandNames = new Map<string, string>()
  for (const command of commands) {
    if (command.name) {
      const key = command.name.toLowerCase()
      const previous = commandNames.get(key)
      if (previous) {
        errors.push(
          `duplicate command name "${command.name}" (${previous}, ${command.id})`,
        )
      } else {
        commandNames.set(key, command.id)
      }
    }
  }

  const preferences = catalog.preferences ?? []
  addDuplicateErrors(
    errors,
    "preference",
    preferences.map((preference) => ({
      id: preference.key,
      source: "preferences.yaml",
    })),
  )
  const modelsById = new Map(catalog.models.map((model) => [model.id, model]))
  for (const preference of preferences) {
    const source = `preferences.yaml preference "${preference.key}"`
    if (!categoryIds.has(preference.category)) {
      errors.push(
        `${source} references unknown category "${preference.category}"`,
      )
    }
    const model = modelsById.get(preference.modelId)
    if (!model) {
      errors.push(`${source} references unknown model "${preference.modelId}"`)
      continue
    }
    if (!model.categories.includes(preference.category)) {
      errors.push(
        `${source} model "${preference.modelId}" is not in category "${preference.category}"`,
      )
    }
    const priceKeys = new Set<string>()
    if (model.pricing?.unit === "parameter_table") {
      for (const row of model.pricing.rate) {
        for (const key of Object.keys(row.when)) {
          if (key !== "duration") {
            priceKeys.add(key)
          }
        }
      }
    }
    const reasoningBinding =
      preference.category === "leading-agent"
        ? model.parameters.find(
            (param) => param.id === "parameter_reasoning_effort",
          )
        : undefined
    if (reasoningBinding) {
      priceKeys.add("reasoning_effort")
    }
    const storedParams = preference.parameters ?? {}
    for (const key of Object.keys(storedParams)) {
      if (!priceKeys.has(key)) {
        errors.push(
          `${source} parameter "${key}" is not a price key on model "${preference.modelId}"`,
        )
      }
    }
    for (const key of priceKeys) {
      if (!(key in storedParams)) {
        errors.push(
          `${source} is missing price parameter "${key}" for model "${preference.modelId}"`,
        )
      }
    }
    if (reasoningBinding && "reasoning_effort" in storedParams) {
      const allowedReasoning = reasoningBinding.allowedValues
        ? new Set(reasoningBinding.allowedValues.map(String))
        : (optionValuesByParam.get("parameter_reasoning_effort") ?? new Set())
      const value = String(storedParams.reasoning_effort)
      if (allowedReasoning.size > 0 && !allowedReasoning.has(value)) {
        errors.push(
          `${source} parameter "reasoning_effort" value "${value}" is not allowed on model "${preference.modelId}"`,
        )
      }
    }
    if (
      model.pricing?.unit === "parameter_table" &&
      priceKeys.size > 0 &&
      Array.from(priceKeys).every((key) => key in storedParams)
    ) {
      const hasMatch = model.pricing.rate.some((row) =>
        Array.from(priceKeys).every(
          (key) => String(row.when[key]) === String(storedParams[key]),
        ),
      )
      if (!hasMatch) {
        errors.push(
          `${source} parameters ${JSON.stringify(storedParams)} do not match any price row on model "${preference.modelId}"`,
        )
      }
    }
  }

  return errors
}

export const validateTrackedModels = (
  catalog: Catalog,
  tracked: Readonly<Record<string, string>> = modelsTracker,
): string[] => {
  const modelIds = new Set(catalog.models.map((model) => model.id))
  const errors: string[] = []

  for (const [role, modelId] of Object.entries(tracked)) {
    if (!modelId) {
      errors.push(`modelsTracker.${role} is missing a model id`)
      continue
    }
    if (!modelIds.has(modelId)) {
      errors.push(
        `modelsTracker.${role} references unregistered model "${modelId}"`,
      )
    }
  }

  return errors
}

export const collectCatalogErrors = async () => {
  const { catalog, errors } = await loadCatalog()
  return [
    ...errors,
    ...validateCatalog(catalog),
    ...validateTrackedModels(catalog),
  ]
}

if (import.meta.main) {
  const errors = await collectCatalogErrors()
  if (errors.length > 0) {
    for (const error of errors) {
      console.error(error)
    }
    console.error(`catalog:validate failed with ${errors.length} error(s)`)
    process.exit(1)
  }
  console.log("catalog:validate passed")
}
