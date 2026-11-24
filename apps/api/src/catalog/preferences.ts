import { join } from "node:path"
import { z } from "zod"
import type { ModelPreferenceKey, ModelPreferenceParameters } from "@/type"

export const modelPreferenceKeys = [
  "leading-agent",
  "text-to-image",
  "image-to-image",
  "text-to-video",
  "image-to-video",
  "text-to-speech",
  "music-generation",
] as const satisfies readonly ModelPreferenceKey[]

export type CatalogPreference = {
  key: ModelPreferenceKey
  label: string
  description: string
  category: ModelPreferenceKey
  modelId: string
  parameters: ModelPreferenceParameters
}

const parameterValueSchema = z.union([z.string().min(1), z.number()])

const preferenceSchema = z.object({
  key: z.enum(modelPreferenceKeys),
  label: z.string().min(1),
  description: z.string().min(1),
  category: z.enum(modelPreferenceKeys),
  modelId: z.string().min(1),
  parameters: z.record(z.string(), parameterValueSchema).default({}),
})

const preferencesFileSchema = z.object({
  preferences: z.array(preferenceSchema).min(1),
})

const CATALOG_DIR = process.env.CATALOG_DIR ?? import.meta.dir
const PREFERENCES_FILE = join(CATALOG_DIR, "preferences.yaml")

let cachedCatalogPreferences: CatalogPreference[] | null = null
let loadingCatalogPreferences: Promise<CatalogPreference[]> | null = null

export const preferenceOrder = (key: string) => {
  const index = modelPreferenceKeys.indexOf(key as ModelPreferenceKey)
  return index === -1 ? modelPreferenceKeys.length : index
}

export const loadPreferences = async (
  preferencesFile = PREFERENCES_FILE,
): Promise<CatalogPreference[]> => {
  const source = "preferences.yaml"
  let parsed: unknown
  try {
    parsed = Bun.YAML.parse(await Bun.file(preferencesFile).text())
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`${source}: ${message}`)
  }

  const result = preferencesFileSchema.safeParse(parsed)
  if (!result.success) {
    throw new Error(`${source}: ${result.error.message}`)
  }

  const seenKeys = new Set<string>()
  for (const preference of result.data.preferences) {
    if (seenKeys.has(preference.key)) {
      throw new Error(`${source}: duplicate preference key "${preference.key}"`)
    }
    seenKeys.add(preference.key)
  }

  return result.data.preferences
}

export const resetPreferenceCache = () => {
  cachedCatalogPreferences = null
  loadingCatalogPreferences = null
}

export const getCatalogPreferences = async (
  loader: () => Promise<CatalogPreference[]> = loadPreferences,
): Promise<CatalogPreference[]> => {
  if (cachedCatalogPreferences) {
    return cachedCatalogPreferences
  }
  if (!loadingCatalogPreferences) {
    loadingCatalogPreferences = loader()
      .then((preferences) => {
        cachedCatalogPreferences = preferences
        return preferences
      })
      .finally(() => {
        loadingCatalogPreferences = null
      })
  }
  return loadingCatalogPreferences
}
