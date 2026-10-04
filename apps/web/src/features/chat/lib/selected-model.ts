import type { LlmModel } from "../types"

const SELECTED_MODEL_STORAGE_KEY = "sohizi.chat.modelId"

export function readSelectedModelId(): string | null {
  if (typeof window === "undefined") return null
  const value = window.localStorage.getItem(SELECTED_MODEL_STORAGE_KEY)
  return value ? value : null
}

export function writeSelectedModelId(modelId: string) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(SELECTED_MODEL_STORAGE_KEY, modelId)
}

export function latestRunModelId(
  runs: ReadonlyArray<{ metadata?: unknown }>,
): string | null {
  const metadata = runs.at(-1)?.metadata
  if (!metadata || typeof metadata !== "object") return null
  const usage = (metadata as { usage?: unknown }).usage
  if (!usage || typeof usage !== "object") return null
  const modelId = (usage as { modelId?: unknown }).modelId
  return typeof modelId === "string" && modelId.length > 0 ? modelId : null
}

export function resolveChatModel(
  models: ReadonlyArray<LlmModel>,
  source: { runModelId?: string | null; storedModelId?: string | null },
): LlmModel | null {
  if (models.length === 0) return null
  const runModel = source.runModelId
    ? models.find((model) => model.id === source.runModelId)
    : undefined
  if (runModel) return runModel
  const storedModel = source.storedModelId
    ? models.find((model) => model.id === source.storedModelId)
    : undefined
  if (storedModel) return storedModel
  return models[0] ?? null
}
