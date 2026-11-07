import {
  AUDIO_SUBTYPES,
  GENERATION_TYPES,
  IMAGE_SUBTYPES,
  UPSCALER_SUBTYPES,
  VIDEO_SUBTYPES,
  getDefaultSubtype,
} from "../constants"
import { isPickerAssetType, parseParameterAssetUrls } from "./parameter-assets"
import type { AttachedFile } from "@/components/widgets/file-attachments"
import type { GenerationSubtype, GenerationType } from "../types"

export type ParsedRequestState = {
  generationType: GenerationType
  generationSubtype: GenerationSubtype | null
  selectedModelId: string | null
  parameterValues: Record<string, string>
  prompt: string
  attachments: Array<AttachedFile>
  voice?: string
}

export type RequestSettingsRow = {
  key: string
  value: string
}

export type GenerationDetailTile = {
  label: string
  value: string
}

export type GenerationDetailReference = {
  label: string
  url: string
  type: "image" | "video"
}

export type GenerationDetails = {
  prompt: string
  meta: Array<GenerationDetailTile>
  parameters: Array<GenerationDetailTile>
  references: Array<GenerationDetailReference>
  error: string | null
}

export type GenerationDetailsOptions = {
  credits?: number | null
  error?: string | null
}

const SUBTYPE_LABELS = [
  ...IMAGE_SUBTYPES,
  ...VIDEO_SUBTYPES,
  ...AUDIO_SUBTYPES,
  ...UPSCALER_SUBTYPES,
]
const MEDIA_FIELD_PATTERN =
  /(image|video|thumbnail|poster|frame|mask|reference)/i
const IMAGE_URL_PATTERN = /\.(png|jpe?g|webp|gif|avif|bmp|svg)(\?|#|$)/i
const VIDEO_URL_PATTERN = /\.(mp4|webm|mov|m4v|avi|mkv)(\?|#|$)/i

const GENERATION_TYPE_SET = new Set<string>(
  GENERATION_TYPES.map((type) => type.value),
)
const SUBTYPE_SET = new Set<string>([
  ...IMAGE_SUBTYPES.map((subtype) => subtype.value),
  ...VIDEO_SUBTYPES.map((subtype) => subtype.value),
  ...AUDIO_SUBTYPES.map((subtype) => subtype.value),
  ...UPSCALER_SUBTYPES.map((subtype) => subtype.value),
])

function isGenerationType(value: unknown): value is GenerationType {
  return typeof value === "string" && GENERATION_TYPE_SET.has(value)
}

function isGenerationSubtype(value: unknown): value is GenerationSubtype {
  return typeof value === "string" && SUBTYPE_SET.has(value)
}

function stringifySettingValue(value: unknown): string {
  if (typeof value === "string") return value
  if (Array.isArray(value)) return JSON.stringify(value)
  if (value == null) return ""
  return String(value)
}

function parseSettings(settings: unknown): Record<string, string> {
  if (!settings || typeof settings !== "object") return {}
  return Object.fromEntries(
    Object.entries(settings as Record<string, unknown>).map(([key, value]) => [
      key,
      stringifySettingValue(value),
    ]),
  )
}

function parseAttachments(referencedFiles: unknown): Array<AttachedFile> {
  if (!Array.isArray(referencedFiles)) return []

  return referencedFiles.flatMap((file) => {
    if (!file || typeof file !== "object") return []
    const url = "url" in file && typeof file.url === "string" ? file.url : null
    if (!url) return []
    const type =
      "type" in file && typeof file.type === "string" ? file.type : "image"
    return [
      {
        id: crypto.randomUUID(),
        status: "uploaded" as const,
        type,
        url,
      },
    ]
  })
}

export function parseStoredRequest(
  request: Record<string, unknown> | null,
): ParsedRequestState | null {
  if (!request) return null

  const context =
    request.context && typeof request.context === "object"
      ? (request.context as Record<string, unknown>)
      : {}

  const generationType = isGenerationType(context.generationType)
    ? context.generationType
    : "image"
  const generationSubtype = isGenerationSubtype(context.subtype)
    ? context.subtype
    : getDefaultSubtype(generationType)
  const model =
    typeof request.model === "string" && request.model.length > 0
      ? request.model
      : typeof context.model === "string" && context.model.length > 0
        ? context.model
        : null

  const attachments = parseAttachments(context.referencedFiles)
  const parameterValues = parseSettings(request.settings)
  const topLevelPrompt =
    typeof request.prompt === "string" ? request.prompt : ""
  const prompt = parameterValues.prompt || topLevelPrompt

  return {
    generationType,
    generationSubtype,
    selectedModelId: model,
    parameterValues: prompt ? { ...parameterValues, prompt } : parameterValues,
    prompt,
    attachments,
    voice: typeof context.voice === "string" ? context.voice : undefined,
  }
}

export function flattenRequestSettings(
  request: Record<string, unknown> | null,
): Array<RequestSettingsRow> {
  const parsed = parseStoredRequest(request)
  if (!parsed) return []

  const rows: Array<RequestSettingsRow> = []
  const add = (key: string, value: unknown) => {
    if (value == null || value === "") return
    rows.push({
      key,
      value: typeof value === "string" ? value : JSON.stringify(value),
    })
  }

  add("model", parsed.selectedModelId)
  add("prompt", parsed.prompt)
  add("generationType", parsed.generationType)
  add("subtype", parsed.generationSubtype)
  add("voice", parsed.voice)
  for (const [key, value] of Object.entries(parsed.parameterValues)) {
    if (key === "prompt") continue
    add(key, value)
  }
  parsed.attachments.forEach((attachment, index) => {
    if (attachment.status === "uploaded") {
      add(`referencedFile[${index}]`, attachment.url)
    }
  })

  return rows
}

export function humanizeSettingKey(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (character) => character.toUpperCase())
}

function isPresentSettingValue(value: string): boolean {
  return value !== "" && value !== "[]" && value !== "{}"
}

export function getGenerationDetails(
  request: Record<string, unknown> | null,
  options: GenerationDetailsOptions = {},
): GenerationDetails | null {
  const parsed = parseStoredRequest(request)
  if (!parsed) return null

  const typeLabel =
    GENERATION_TYPES.find((type) => type.value === parsed.generationType)
      ?.label ?? parsed.generationType
  const subtypeLabel = parsed.generationSubtype
    ? (SUBTYPE_LABELS.find(
        (subtype) => subtype.value === parsed.generationSubtype,
      )?.label ?? parsed.generationSubtype)
    : null

  const meta: Array<GenerationDetailTile> = []
  if (parsed.selectedModelId) {
    meta.push({ label: "Model", value: parsed.selectedModelId })
  }
  meta.push({ label: "Type", value: typeLabel })
  if (subtypeLabel) {
    meta.push({ label: "Mode", value: subtypeLabel })
  }
  if (parsed.voice) {
    meta.push({ label: "Voice", value: parsed.voice })
  }
  if (options.credits != null && Number.isFinite(options.credits)) {
    meta.push({
      label: "Credits",
      value: String(options.credits),
    })
  }

  const parameters: Array<GenerationDetailTile> = []
  const references: Array<GenerationDetailReference> = []

  for (const [key, value] of Object.entries(parsed.parameterValues)) {
    if (key === "prompt") continue
    if (!isPresentSettingValue(value)) continue

    const mediaReferences = extractMediaReferences(key, value)
    if (mediaReferences.length > 0) {
      references.push(...mediaReferences)
      continue
    }

    parameters.push({ label: humanizeSettingKey(key), value })
  }

  parsed.attachments.forEach((attachment, index) => {
    if (attachment.status !== "uploaded") return
    const type = inferMediaType(attachment.url, attachment.type)
    if (!type) return
    references.push({
      label: `Reference ${index + 1}`,
      url: attachment.url,
      type,
    })
  })

  const normalizedError =
    typeof options.error === "string" && options.error.trim().length > 0
      ? options.error.trim()
      : null

  return {
    prompt: parsed.prompt,
    meta,
    parameters,
    references: dedupeReferences(references),
    error: normalizedError,
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

function inferMediaType(url: string, hint: string): "image" | "video" | null {
  if (VIDEO_URL_PATTERN.test(url) || /video/i.test(hint)) return "video"
  if (
    IMAGE_URL_PATTERN.test(url) ||
    /image|thumbnail|poster|frame|mask/i.test(hint)
  ) {
    return "image"
  }
  if (MEDIA_FIELD_PATTERN.test(hint) && isHttpUrl(url)) return "image"
  return null
}

function parseStoredReferences(
  value: string,
): Array<{ url: string; type: string }> {
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []

    return parsed.flatMap((item) => {
      if (typeof item === "string" && item.length > 0) {
        return [{ url: item, type: "image" }]
      }
      if (
        item &&
        typeof item === "object" &&
        typeof item.url === "string" &&
        item.url.length > 0
      ) {
        return [
          {
            url: item.url,
            type: isPickerAssetType(item.type) ? item.type : "image",
          },
        ]
      }
      return []
    })
  } catch {
    return []
  }
}

function extractMediaReferences(
  key: string,
  value: string,
): Array<GenerationDetailReference> {
  const label = humanizeSettingKey(key)

  if (key === "references") {
    return parseStoredReferences(value).flatMap((reference) => {
      const type = inferMediaType(reference.url, reference.type)
      if (!type) return []
      return [{ label, url: reference.url, type }]
    })
  }

  return parseParameterAssetUrls(value).flatMap((url) => {
    const type = inferMediaType(url, key)
    if (!type) return []
    return [{ label, url, type }]
  })
}

function dedupeReferences(
  references: Array<GenerationDetailReference>,
): Array<GenerationDetailReference> {
  const seen = new Set<string>()
  return references.filter((reference) => {
    const key = `${reference.url}:${reference.type}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
