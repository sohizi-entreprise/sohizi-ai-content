import type { GenerationType, MediaAspectRatio } from '../types'
import { isPickerAssetType, type PickerAssetType } from './parameter-assets'

export const AGENT_ASPECT_RATIOS = ['1:1', '4:3', '16:9', '9:16'] as const satisfies ReadonlyArray<MediaAspectRatio>
export const AGENT_QUALITIES = ['high', 'medium', 'low'] as const

export type AgentQuality = (typeof AGENT_QUALITIES)[number]
export type AgentReference = {
  url: string
  type: PickerAssetType
}

export const DEFAULT_AGENT_ASPECT_RATIO: MediaAspectRatio = '16:9'
export const DEFAULT_AGENT_QUALITY: AgentQuality = 'high'
export const AGENT_MAX_REFERENCES = 10

export const AGENT_IMAGE_REFERENCE_TYPES: PickerAssetType[] = ['image']
export const AGENT_VIDEO_REFERENCE_TYPES: PickerAssetType[] = ['image', 'video', 'audio']

export function getAgentReferenceFileTypes(type: GenerationType): PickerAssetType[] {
  return type === 'video' ? AGENT_VIDEO_REFERENCE_TYPES : AGENT_IMAGE_REFERENCE_TYPES
}

export function parseAgentReferences(value: string | undefined): AgentReference[] {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []

    return parsed.flatMap((item) => {
      if (typeof item === 'string' && item.length > 0) {
        return [{ url: item, type: 'image' as const }]
      }
      if (
        item
        && typeof item === 'object'
        && typeof item.url === 'string'
        && item.url.length > 0
        && isPickerAssetType(item.type)
      ) {
        return [{ url: item.url, type: item.type }]
      }
      return []
    })
  } catch {
    return []
  }
}

export function serializeAgentReferences(references: AgentReference[]): string {
  return JSON.stringify(
    references
      .filter((item) => item.url.length > 0)
      .map((item) => ({ url: item.url, type: item.type })),
  )
}

function isAgentAspectRatio(value: string): value is MediaAspectRatio {
  return (AGENT_ASPECT_RATIOS as readonly string[]).includes(value)
}

function isAgentQuality(value: string): value is AgentQuality {
  return (AGENT_QUALITIES as readonly string[]).includes(value)
}

export function defaultAgentParameterValues(
  existing: Record<string, string> = {},
): Record<string, string> {
  const references = parseAgentReferences(existing.references)

  return {
    aspectRatio: isAgentAspectRatio(existing.aspectRatio)
      ? existing.aspectRatio
      : DEFAULT_AGENT_ASPECT_RATIO,
    quality: isAgentQuality(existing.quality) ? existing.quality : DEFAULT_AGENT_QUALITY,
    references: serializeAgentReferences(references),
  }
}

export function agentSettingsFromValues(values: Record<string, string>): {
  aspectRatio: string
  quality: string
} {
  const seeded = defaultAgentParameterValues(values)
  return {
    aspectRatio: seeded.aspectRatio,
    quality: seeded.quality,
  }
}
