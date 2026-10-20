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
