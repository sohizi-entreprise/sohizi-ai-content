import type { ModelParameterBinding } from "@/features/admin/types"

export type PickerAssetType = "image" | "video" | "audio"

export type PickerAsset = {
  id: string
  name: string
  url: string
  type: PickerAssetType
}

export function isPickerAssetType(value: unknown): value is PickerAssetType {
  return value === "image" || value === "video" || value === "audio"
}

const FILE_TYPE_BY_KEY: Record<string, PickerAssetType> = {
  image: "image",
  images: "image",
  last_image: "image",
  reference_images: "image",
  video: "video",
  reference_videos: "video",
  audio: "audio",
  reference_audios: "audio",
}

export function getUploaderFileType(
  parameter: ModelParameterBinding,
): PickerAssetType {
  if (parameter.constraints?.fileType) {
    return parameter.constraints.fileType
  }
  return FILE_TYPE_BY_KEY[parameter.key] ?? "image"
}

export function getUploaderFileTypes(
  parameter: ModelParameterBinding,
): Array<PickerAssetType> {
  return [getUploaderFileType(parameter)]
}

export function queryTypeForFileTypes(
  fileTypes: Array<PickerAssetType>,
): PickerAssetType | undefined {
  return fileTypes.length === 1 ? fileTypes[0] : undefined
}

export function acceptForFileTypes(fileTypes: Array<PickerAssetType>): string {
  const mime: Record<PickerAssetType, string> = {
    image: "image/*",
    video: "video/*",
    audio: "audio/*",
  }
  return fileTypes.map((type) => mime[type]).join(",")
}

export function describeFileTypes(fileTypes: Array<PickerAssetType>): string {
  if (fileTypes.length === 1) return fileTypes[0]
  if (fileTypes.length === 2) return `${fileTypes[0]} or ${fileTypes[1]}`
  return `${fileTypes.slice(0, -1).join(", ")}, or ${fileTypes[fileTypes.length - 1]}`
}

export function chooseLabelForFileTypes(
  fileTypes: Array<PickerAssetType>,
  allowMultiple: boolean,
): string {
  if (fileTypes.length !== 1) return "files"
  const type = fileTypes[0]
  if (!allowMultiple || type === "audio") return type
  return `${type}s`
}

export function isArrayParameter(parameter: ModelParameterBinding) {
  return (
    parameter.type === "array<string>" || parameter.type === "array<number>"
  )
}

export function getMaxAssetItems(parameter: ModelParameterBinding) {
  if (!isArrayParameter(parameter)) return 1
  return parameter.constraints?.max ?? Number.POSITIVE_INFINITY
}

export function parseParameterAssetUrls(
  value: string | undefined,
): Array<string> {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item): item is string => typeof item === "string" && item.length > 0,
      )
    }
  } catch {
    // Stored as a single URL string.
  }

  return [value]
}

export function serializeParameterAssetUrls(
  urls: Array<string>,
  allowMultiple: boolean,
) {
  const next = urls.filter(Boolean)
  if (!allowMultiple) return next[0] ?? ""
  return JSON.stringify(next)
}

export function isStoredBoolean(
  value: unknown,
): value is boolean | "true" | "false" {
  return (
    value === true || value === false || value === "true" || value === "false"
  )
}

export function coerceParameterSettings(
  values: Record<string, string>,
  parameters: Array<ModelParameterBinding>,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...values }

  for (const parameter of parameters) {
    const raw = values[parameter.key]
    if (parameter.type === "boolean") {
      if (raw === "true" || raw === "false") {
        next[parameter.key] = raw === "true"
      }
      continue
    }
    if (parameter.type === "number") {
      if (raw == null || raw === "") continue
      const numeric = Number(raw)
      if (Number.isFinite(numeric)) {
        next[parameter.key] = numeric
      }
      continue
    }
    if (parameter.xUiComponent !== "uploader") continue
    next[parameter.key] = isArrayParameter(parameter)
      ? parseParameterAssetUrls(raw)
      : (parseParameterAssetUrls(raw)[0] ?? "")
  }

  return next
}
