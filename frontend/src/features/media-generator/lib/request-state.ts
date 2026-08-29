import {
  AUDIO_SUBTYPES,
  GENERATION_TYPES,
  IMAGE_SUBTYPES,
  VIDEO_SUBTYPES,
  getDefaultSubtype,
  showsAgentMode,
} from '../constants'
import {
  defaultAgentParameterValues,
  serializeAgentReferences,
} from './agent-settings'
import { isPickerAssetType } from './parameter-assets'
import type { AttachedFile } from '@/components/widgets/file-attachments'
import type { GenerationSubtype, GenerationType, MediaRunMode } from '../types'

export type ParsedRequestState = {
  generationType: GenerationType
  generationSubtype: GenerationSubtype | null
  selectedModelId: string | null
  parameterValues: Record<string, string>
  prompt: string
  attachments: Array<AttachedFile>
  runMode: MediaRunMode
  voice?: string
}

export type RequestSettingsRow = {
  key: string
  value: string
}

const GENERATION_TYPE_SET = new Set<string>(
  GENERATION_TYPES.map((type) => type.value),
)
const SUBTYPE_SET = new Set<string>([
  ...IMAGE_SUBTYPES.map((subtype) => subtype.value),
  ...VIDEO_SUBTYPES.map((subtype) => subtype.value),
  ...AUDIO_SUBTYPES.map((subtype) => subtype.value),
])

function isGenerationType(value: unknown): value is GenerationType {
  return typeof value === 'string' && GENERATION_TYPE_SET.has(value)
}

function isGenerationSubtype(value: unknown): value is GenerationSubtype {
  return typeof value === 'string' && SUBTYPE_SET.has(value)
}

function stringifySettingValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return JSON.stringify(value)
  if (value == null) return ''
  return String(value)
}

function parseSettings(settings: unknown): Record<string, string> {
  if (!settings || typeof settings !== 'object') return {}
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
    if (!file || typeof file !== 'object') return []
    const url = 'url' in file && typeof file.url === 'string' ? file.url : null
    if (!url) return []
    const type =
      'type' in file && typeof file.type === 'string' ? file.type : 'image'
    return [
      {
        id: crypto.randomUUID(),
        status: 'uploaded' as const,
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
    request.context && typeof request.context === 'object'
      ? (request.context as Record<string, unknown>)
      : {}

  const generationType = isGenerationType(context.generationType)
    ? context.generationType
    : 'image'
  const generationSubtype = isGenerationSubtype(context.subtype)
    ? context.subtype
    : getDefaultSubtype(generationType)
  const model =
    typeof request.model === 'string' && request.model.length > 0
      ? request.model
      : typeof context.model === 'string' && context.model.length > 0
        ? context.model
        : null

  const attachments = parseAttachments(context.referencedFiles)
  const runMode: MediaRunMode = request.runMode === 'agent' ? 'agent' : 'direct'
  let parameterValues = parseSettings(request.settings)

  if (runMode === 'agent' && showsAgentMode(generationType)) {
    parameterValues = defaultAgentParameterValues({
      ...parameterValues,
      references: serializeAgentReferences(
        attachments.flatMap((attachment) =>
          attachment.status === 'uploaded' && isPickerAssetType(attachment.type)
            ? [{ url: attachment.url, type: attachment.type }]
            : [],
        ),
      ),
    })
  }

  return {
    generationType,
    generationSubtype,
    selectedModelId: model,
    parameterValues,
    prompt: typeof request.prompt === 'string' ? request.prompt : '',
    attachments,
    runMode,
    voice: typeof context.voice === 'string' ? context.voice : undefined,
  }
}

export function flattenRequestSettings(
  request: Record<string, unknown> | null,
): Array<RequestSettingsRow> {
  const parsed = parseStoredRequest(request)
  if (!parsed) return []

  const rows: Array<RequestSettingsRow> = []
  const add = (key: string, value: unknown) => {
    if (value == null || value === '') return
    rows.push({
      key,
      value: typeof value === 'string' ? value : JSON.stringify(value),
    })
  }

  add('model', parsed.selectedModelId)
  add('prompt', parsed.prompt)
  add('runMode', parsed.runMode)
  add('generationType', parsed.generationType)
  add('subtype', parsed.generationSubtype)
  add('voice', parsed.voice)
  for (const [key, value] of Object.entries(parsed.parameterValues)) {
    add(key, value)
  }
  parsed.attachments.forEach((attachment, index) => {
    if (attachment.status === 'uploaded') {
      add(`referencedFile[${index}]`, attachment.url)
    }
  })

  return rows
}
