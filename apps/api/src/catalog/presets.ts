import { readdir } from "node:fs/promises"
import { join } from "node:path"
import { z } from "zod"

export const generationTargets = ["image", "video", "audio", "project"] as const

export type GenerationTarget = (typeof generationTargets)[number]

export type PresetIllustration = {
  url: string | null
  type: "video" | "image"
}

export type CatalogPresetOption = {
  label: string
  value: string
  illustration: PresetIllustration
  promptModifier: string
}

export type CatalogPreset = {
  id: string
  key: string
  label: string
  generationTarget: GenerationTarget
  options: CatalogPresetOption[]
}

export type PublicPresetOption = Omit<CatalogPresetOption, "promptModifier">

export type PublicPreset = Omit<CatalogPreset, "options"> & {
  options: PublicPresetOption[]
}

const illustrationSchema = z.object({
  url: z.string().nullable(),
  type: z.enum(["video", "image"]),
})

const presetSchema = z.object({
  id: z.string().min(1),
  key: z.string().min(1),
  label: z.string().min(1),
  generationTarget: z.enum(generationTargets),
  options: z
    .array(
      z.object({
        label: z.string().min(1),
        value: z.string().min(1),
        illustration: illustrationSchema,
        promptModifier: z.string().min(1),
      }),
    )
    .min(1),
})

const PRESET_KEY_ORDER = [
  "format",
  "genre",
  "tone",
  "targetAudience",
  "primaryPlatform",
  "outlineStructure",
  "narrativeStyle",
  "videoAspectRatio",
  "characterStyle",
]

const PRESETS_DIR = join(import.meta.dir, "presets")

let cachedPresets: CatalogPreset[] | null = null
let loadingPresets: Promise<CatalogPreset[]> | null = null

const presetOrder = (key: string) => {
  const index = PRESET_KEY_ORDER.indexOf(key)
  return index === -1 ? PRESET_KEY_ORDER.length : index
}

const readOptionValue = (raw: unknown): string | null => {
  if (typeof raw === "string" && raw.length > 0) {
    return raw
  }
  if (raw != null && typeof raw === "object" && "value" in raw) {
    const value = raw.value
    if (typeof value === "string" && value.length > 0) {
      return value
    }
  }
  return null
}

export const loadPresets = async (
  presetsDir = PRESETS_DIR,
): Promise<CatalogPreset[]> => {
  const files = (await readdir(presetsDir))
    .filter((file) => file.endsWith(".yaml"))
    .sort()
  const presets: CatalogPreset[] = []
  const seenIds = new Set<string>()
  const seenKeys = new Set<string>()

  for (const file of files) {
    const source = `presets/${file}`
    let parsed: unknown
    try {
      parsed = Bun.YAML.parse(await Bun.file(join(presetsDir, file)).text())
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`${source}: ${message}`)
    }

    const result = presetSchema.safeParse(parsed)
    if (!result.success) {
      throw new Error(`${source}: ${result.error.message}`)
    }

    const preset = result.data
    if (seenIds.has(preset.id)) {
      throw new Error(`${source}: duplicate preset id "${preset.id}"`)
    }
    if (seenKeys.has(preset.key)) {
      throw new Error(`${source}: duplicate preset key "${preset.key}"`)
    }
    const optionValues = new Set<string>()
    for (const option of preset.options) {
      if (optionValues.has(option.value)) {
        throw new Error(`${source}: duplicate option value "${option.value}"`)
      }
      optionValues.add(option.value)
    }

    seenIds.add(preset.id)
    seenKeys.add(preset.key)
    presets.push(preset)
  }

  return presets.sort(
    (left, right) => presetOrder(left.key) - presetOrder(right.key),
  )
}

export const resetPresetCache = () => {
  cachedPresets = null
  loadingPresets = null
}

export const getPresets = async (): Promise<CatalogPreset[]> => {
  if (cachedPresets) {
    return cachedPresets
  }
  if (!loadingPresets) {
    loadingPresets = loadPresets()
      .then((presets) => {
        cachedPresets = presets
        return presets
      })
      .finally(() => {
        loadingPresets = null
      })
  }
  return loadingPresets
}

export const filterPresets = (
  presets: CatalogPreset[],
  generationTarget?: GenerationTarget,
): CatalogPreset[] => {
  if (!generationTarget) {
    return presets
  }
  return presets.filter(
    (preset) => preset.generationTarget === generationTarget,
  )
}

export const toPublicPresets = (presets: CatalogPreset[]): PublicPreset[] =>
  presets.map((preset) => ({
    id: preset.id,
    key: preset.key,
    label: preset.label,
    generationTarget: preset.generationTarget,
    options: preset.options.map((option) => ({
      label: option.label,
      value: option.value,
      illustration: option.illustration,
    })),
  }))

export type PresetSelection = {
  id: string
  value: string
}

const isPresetSelection = (value: unknown): value is PresetSelection => {
  if (value == null || typeof value !== "object") {
    return false
  }
  const record = value as Record<string, unknown>
  return typeof record.id === "string" && typeof record.value === "string"
}

const selectionsFromSettings = (
  presets: CatalogPreset[],
  settings: Array<PresetSelection> | Record<string, unknown> | null | undefined,
): PresetSelection[] => {
  if (!settings) {
    return []
  }
  if (Array.isArray(settings)) {
    return settings.filter(isPresetSelection)
  }
  if (Array.isArray(settings.presets)) {
    return settings.presets.filter(isPresetSelection)
  }

  const selections: PresetSelection[] = []
  for (const preset of presets) {
    const value = readOptionValue(settings[preset.key])
    if (!value) {
      continue
    }
    selections.push({ id: preset.id, value })
  }
  return selections
}

export const buildProjectBriefContent = (
  presets: CatalogPreset[],
  settings: Array<PresetSelection> | Record<string, unknown> | null | undefined,
): string => {
  const lines: string[] = []
  for (const selection of selectionsFromSettings(presets, settings)) {
    const preset = presets.find((item) => item.id === selection.id)
    if (!preset) {
      continue
    }
    const option = preset.options.find((item) => item.value === selection.value)
    if (!option) {
      continue
    }
    lines.push(`- **${preset.label}**: ${option.promptModifier}`)
  }

  if (lines.length === 0) {
    return ""
  }

  return `# Project Brief\n\n${lines.join("\n")}\n`
}
