import type { LlmModel, ModelReasoningEffort } from "../types"

export function resolveReasoningEffort(
  model: LlmModel | null | undefined,
  overrides: Record<string, string> | undefined,
): string | undefined {
  if (!model?.reasoningEffort) return undefined
  if (overrides && model.id in overrides) return overrides[model.id]
  return model.reasoningEffort.defaultValue ?? undefined
}

export function reasoningEffortLabel(
  reasoningEffort: ModelReasoningEffort | null | undefined,
  value: string | undefined,
): string | undefined {
  if (!reasoningEffort || !value) return undefined
  return (
    reasoningEffort.options.find((option) => option.value === value)?.label ??
    value
  )
}
