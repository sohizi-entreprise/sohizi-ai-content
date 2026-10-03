import { SubmitPayload } from "./type"
import { getVendorParamsMapping } from "../repo"

function isMediaUrl(value: string): boolean {
  if (value.startsWith("data:")) return true
  try {
    const parsed = new URL(value)
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch {
    return false
  }
}

function urlsFromValue(value: unknown): string[] {
  if (typeof value === "string") {
    return isMediaUrl(value) ? [value] : []
  }
  if (Array.isArray(value)) {
    return value.flatMap(urlsFromValue)
  }
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(
      urlsFromValue,
    )
  }
  return []
}

export function extractOutputUrls(data: unknown): string[] {
  return [...new Set(urlsFromValue(data))]
}

type VendorParameterMapping = {
  parameter: string
  type?: string | null
  vendorParameter: string | null
  optionValue: string | null
  vendorOption: string | null
}

export function applyVendorParameterMapping(
  payload: SubmitPayload,
  mappings: Array<VendorParameterMapping>,
): SubmitPayload {
  const parameterMap: Record<string, string> = {}
  const optionMap: Record<string, string> = {}
  const numberParameters = new Set<string>()

  for (const parameter of mappings) {
    if (parameter.vendorParameter) {
      parameterMap[parameter.parameter] = parameter.vendorParameter
    }
    if (parameter.optionValue && parameter.vendorOption) {
      optionMap[parameter.optionValue] = parameter.vendorOption
    }
    if (parameter.type === "number") {
      numberParameters.add(parameter.parameter)
    }
  }

  const mappedPayload: SubmitPayload = {}

  for (const [key, value] of Object.entries(payload)) {
    const mappedKey = parameterMap[key] || key
    mappedPayload[mappedKey] = mapParameterValue(
      key,
      value,
      optionMap,
      numberParameters,
    )
  }

  return mappedPayload
}

function mapParameterValue(
  key: string,
  value: SubmitPayload[string],
  optionMap: Record<string, string>,
  numberParameters: Set<string>,
): SubmitPayload[string] {
  if (Array.isArray(value)) {
    return value.map((item) =>
      typeof item === "string" ? optionMap[item] || item : item,
    )
  }

  if (typeof value !== "string") return value

  const mapped = optionMap[value] || value
  if (!numberParameters.has(key)) return mapped

  const numeric = Number(mapped)
  return Number.isFinite(numeric) && mapped.trim() !== "" ? numeric : mapped
}

export const mapVendorPayload = async (
  vendor: string,
  modelId: string,
  payload: SubmitPayload,
) => {
  const parameters = Object.keys(payload)
  const parametersMapping = await getVendorParamsMapping(
    vendor,
    modelId,
    parameters,
  )

  return applyVendorParameterMapping(payload, parametersMapping)
}
