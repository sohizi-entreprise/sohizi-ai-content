import { readdir } from "node:fs/promises"
import { join } from "node:path"
import type { ModelBasePricing } from "@/type"

export type CatalogCategory = {
  id: string
  name: string
  description: string
}

export type CatalogParameterOption = {
  id: string
  value: string
  label: string
  description?: string | null
}

export type CatalogFileType = "image" | "video" | "audio"

export type CatalogParameter = {
  id: string
  key: string
  label: string
  type: string
  description?: string | null
  xUiComponent?: string | null
  fileType?: CatalogFileType | null
  options: CatalogParameterOption[]
}

export type CatalogModelParameter = {
  id: string
  required?: boolean
  defaultValue?: unknown
  allowedValues?: unknown[]
  constraints?: {
    min?: number
    max?: number
    step?: number
    fileType?: CatalogFileType
  } | null
}

export type CatalogModel = {
  id: string
  name: string
  provider: string
  description?: string | null
  contextWindow: number | null
  pricing: ModelBasePricing | null
  categories: string[]
  parameters: CatalogModelParameter[]
  sourceFile: string
}

export type CatalogVendorBinding = {
  id: string
  apiName: string
  priority?: number
}

export type CatalogVendorOptionMapping = {
  value?: unknown
  mappedValue?: unknown
}

export type CatalogVendorParamMapping = {
  vendorParamName?: string | null
  vendorDefaultValue?: string | null
  optionMapping?: Record<string, CatalogVendorOptionMapping>
}

export type CatalogVendor = {
  id: string
  name: string
  adapter: string
  url?: string | null
  kind: string
  rateLimit?: {
    rpm: number
    burst?: number
    maxConcurrency: number
  } | null
  circuitConfig?: {
    cooldownMs: number
    probeTtlMs: number
  } | null
  models: CatalogVendorBinding[]
  parametersMapping: Record<string, CatalogVendorParamMapping>
  modelParameterOverrides: Record<
    string,
    Record<string, { vendorParamName?: string | null }>
  >
  sourceFile: string
}

export type Catalog = {
  categories: CatalogCategory[]
  parameters: CatalogParameter[]
  models: CatalogModel[]
  vendors: CatalogVendor[]
}

export type LoadedCatalog = {
  catalog: Catalog
  errors: string[]
}

const CATALOG_DIR = import.meta.dir

const parseYaml = (text: string, source: string): unknown => {
  try {
    return Bun.YAML.parse(text)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`${source}: ${message}`)
  }
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : []

const asString = (value: unknown): string =>
  value == null ? "" : String(value)

const asFileType = (value: unknown): CatalogFileType | undefined => {
  if (value === "image" || value === "video" || value === "audio") {
    return value
  }
  return undefined
}

export const withInheritedFileType = (
  constraints: CatalogModelParameter["constraints"],
  fileType?: CatalogFileType | null,
): CatalogModelParameter["constraints"] => {
  if (constraints?.fileType || !fileType) {
    return constraints ?? null
  }
  return {
    ...constraints,
    fileType,
  }
}

export const parseContextWindow = (value: unknown): number | null => {
  if (value == null) return null
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value)
  }
  if (typeof value === "string") {
    const parsed = Number(value.replace(/_/g, ""))
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null
  }
  return null
}

const parsePricing = (value: unknown): ModelBasePricing | null => {
  const record = asRecord(value)
  if (!record) return null
  return record as ModelBasePricing
}

const parseParameter = (value: unknown): CatalogParameter => {
  const record = asRecord(value) ?? {}
  return {
    id: asString(record.id),
    key: asString(record.key),
    label: asString(record.label),
    type: asString(record.type),
    description:
      record.description == null ? null : asString(record.description),
    xUiComponent:
      record.xUiComponent == null ? null : asString(record.xUiComponent),
    fileType: asFileType(record.fileType) ?? null,
    options: asArray(record.options).map((option) => {
      const optionRecord = asRecord(option) ?? {}
      return {
        id: asString(optionRecord.id),
        value: asString(optionRecord.value),
        label: asString(optionRecord.label),
        description:
          optionRecord.description == null
            ? null
            : asString(optionRecord.description),
      }
    }),
  }
}

const parseModel = (value: unknown, sourceFile: string): CatalogModel => {
  const record = asRecord(value) ?? {}
  return {
    id: asString(record.id),
    name: asString(record.name),
    provider: asString(record.provider),
    description:
      record.description == null ? null : asString(record.description),
    contextWindow: parseContextWindow(record.contextWindow),
    pricing: parsePricing(record.pricing),
    categories: asArray(record.categories).map((category) =>
      asString(category),
    ),
    parameters: asArray(record.parameters).map((parameter) => {
      const parameterRecord = asRecord(parameter) ?? {}
      const constraints = asRecord(parameterRecord.constraints)
      return {
        id: asString(parameterRecord.id),
        required: Boolean(parameterRecord.required),
        defaultValue: parameterRecord.defaultValue,
        allowedValues: Array.isArray(parameterRecord.allowedValues)
          ? parameterRecord.allowedValues
          : undefined,
        constraints: constraints
          ? {
              min:
                typeof constraints.min === "number"
                  ? constraints.min
                  : undefined,
              max:
                typeof constraints.max === "number"
                  ? constraints.max
                  : undefined,
              step:
                typeof constraints.step === "number"
                  ? constraints.step
                  : undefined,
              fileType: asFileType(constraints.fileType),
            }
          : null,
      }
    }),
    sourceFile,
  }
}

const parseVendor = (value: unknown, sourceFile: string): CatalogVendor => {
  const record = asRecord(value) ?? {}
  const parametersMapping: CatalogVendor["parametersMapping"] = {}
  for (const [parameterId, mapping] of Object.entries(
    asRecord(record.parametersMapping) ?? {},
  )) {
    const mappingRecord = asRecord(mapping) ?? {}
    const optionMapping: Record<string, CatalogVendorOptionMapping> = {}
    for (const [optionId, option] of Object.entries(
      asRecord(mappingRecord.optionMapping) ?? {},
    )) {
      const optionRecord = asRecord(option) ?? {}
      optionMapping[optionId] = {
        value: optionRecord.value,
        mappedValue: optionRecord.mappedValue,
      }
    }
    parametersMapping[parameterId] = {
      vendorParamName:
        mappingRecord.vendorParamName == null
          ? null
          : asString(mappingRecord.vendorParamName),
      vendorDefaultValue:
        mappingRecord.vendorDefaultValue == null
          ? null
          : asString(mappingRecord.vendorDefaultValue),
      optionMapping,
    }
  }

  const modelParameterOverrides: CatalogVendor["modelParameterOverrides"] = {}
  for (const [modelId, overrides] of Object.entries(
    asRecord(record.modelParameterOverrides) ?? {},
  )) {
    const overrideRecord = asRecord(overrides) ?? {}
    modelParameterOverrides[modelId] = {}
    for (const [parameterId, override] of Object.entries(overrideRecord)) {
      const overrideValue = asRecord(override) ?? {}
      modelParameterOverrides[modelId][parameterId] = {
        vendorParamName:
          overrideValue.vendorParamName == null
            ? null
            : asString(overrideValue.vendorParamName),
      }
    }
  }

  const rateLimit = asRecord(record.rateLimit)
  const circuitConfig = asRecord(record.circuitConfig)

  return {
    id: asString(record.id),
    name: asString(record.name),
    adapter: asString(record.adapter),
    url: record.url == null ? null : asString(record.url),
    kind: asString(record.kind),
    rateLimit: rateLimit
      ? {
          rpm: Number(rateLimit.rpm),
          burst: rateLimit.burst == null ? undefined : Number(rateLimit.burst),
          maxConcurrency: Number(rateLimit.maxConcurrency),
        }
      : null,
    circuitConfig: circuitConfig
      ? {
          cooldownMs: Number(circuitConfig.cooldownMs),
          probeTtlMs: Number(circuitConfig.probeTtlMs),
        }
      : null,
    models: asArray(record.models).map((binding) => {
      const bindingRecord = asRecord(binding) ?? {}
      return {
        id: asString(bindingRecord.id),
        apiName: asString(bindingRecord.apiName),
        priority:
          typeof bindingRecord.priority === "number"
            ? bindingRecord.priority
            : undefined,
      }
    }),
    parametersMapping,
    modelParameterOverrides,
    sourceFile,
  }
}

export const loadCatalog = async (
  catalogDir = CATALOG_DIR,
): Promise<LoadedCatalog> => {
  const errors: string[] = []
  const catalog: Catalog = {
    categories: [],
    parameters: [],
    models: [],
    vendors: [],
  }

  const readFile = async (relativePath: string) => {
    const absolutePath = join(catalogDir, relativePath)
    try {
      return parseYaml(await Bun.file(absolutePath).text(), relativePath)
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
      return null
    }
  }

  const categoriesFile = asRecord(await readFile("categories.yaml"))
  if (categoriesFile) {
    catalog.categories = asArray(categoriesFile.categories).map((category) => {
      const record = asRecord(category) ?? {}
      return {
        id: asString(record.id),
        name: asString(record.name),
        description: asString(record.description),
      }
    })
  }

  const parametersFile = asRecord(await readFile("parameters.yaml"))
  if (parametersFile) {
    catalog.parameters = asArray(parametersFile.parameters).map(parseParameter)
  }

  const modelFiles = (await readdir(join(catalogDir, "models")))
    .filter((file) => file.endsWith(".yaml"))
    .sort()
  for (const file of modelFiles) {
    const relativePath = `models/${file}`
    const parsed = asRecord(await readFile(relativePath))
    if (!parsed) continue
    catalog.models.push(
      ...asArray(parsed.models).map((model) => parseModel(model, relativePath)),
    )
  }

  const vendorFiles = (await readdir(join(catalogDir, "vendors")))
    .filter((file) => file.endsWith(".yaml"))
    .sort()
  for (const file of vendorFiles) {
    const relativePath = `vendors/${file}`
    const parsed = await readFile(relativePath)
    if (parsed == null) continue
    catalog.vendors.push(parseVendor(parsed, relativePath))
  }

  return { catalog, errors }
}
