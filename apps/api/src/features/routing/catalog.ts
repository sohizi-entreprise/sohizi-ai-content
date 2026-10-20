import { listMediaBindings } from "@/features/capacity/bindings"
import type { MediaRoute } from "./types"

export async function listMediaRoutes(modelId: string): Promise<MediaRoute[]> {
  const bindings = await listMediaBindings(modelId)
  return bindings.map((binding) => ({
    modelId,
    vendorName: binding.providerName,
    adapter: binding.adapter,
    apiName: binding.apiName,
    priority: binding.priority,
    rpm: 0,
    burst: 0,
    maxConcurrency: 0,
    cooldownMs: 15_000,
    probeTtlMs: 30_000,
  }))
}
