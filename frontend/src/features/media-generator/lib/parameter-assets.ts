import type { ModelParameterBinding } from '@/features/admin/types'

export type PickerAssetType = 'image' | 'video' | 'audio'

export type PickerAsset = {
  id: string
  name: string
  url: string
  type: PickerAssetType
}

export function getUploaderFileType(parameter: ModelParameterBinding): PickerAssetType {
  return parameter.constraints?.fileType ?? 'image'
}

export function isArrayParameter(parameter: ModelParameterBinding) {
  return parameter.type === 'array<string>' || parameter.type === 'array<number>'
}

export function getMaxAssetItems(parameter: ModelParameterBinding) {
  if (!isArrayParameter(parameter)) return 1
  return parameter.constraints?.max ?? Number.POSITIVE_INFINITY
}

export function parseParameterAssetUrls(value: string | undefined): string[] {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string' && item.length > 0)
    }
  } catch {
    // Stored as a single URL string.
  }

  return [value]
}

export function serializeParameterAssetUrls(urls: string[], allowMultiple: boolean) {
  const next = urls.filter(Boolean)
  if (!allowMultiple) return next[0] ?? ''
  return JSON.stringify(next)
}

export function coerceParameterSettings(
  values: Record<string, string>,
  parameters: ModelParameterBinding[],
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...values }

  for (const parameter of parameters) {
    if (parameter.xUiComponent !== 'uploader') continue
    const raw = values[parameter.key]
    next[parameter.key] = isArrayParameter(parameter)
      ? parseParameterAssetUrls(raw)
      : (parseParameterAssetUrls(raw)[0] ?? '')
  }

  return next
}
