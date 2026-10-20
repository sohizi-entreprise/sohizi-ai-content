import { listLlmBindings } from "@/features/capacity/bindings"
import type { LlmRoute } from "./types"

export async function listLlmRoutes(modelId: string): Promise<LlmRoute[]> {
  const bindings = await listLlmBindings(modelId)
  return bindings.map((binding) => ({
    modelId,
    vendorName: binding.providerName,
    adapter: binding.adapter,
    apiName: binding.apiName,
    priority: binding.priority,
    cooldownMs: 15_000,
  }))
}
