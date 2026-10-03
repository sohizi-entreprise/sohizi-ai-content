import { db } from "@/db"
import { llmModels, llmVendors, llmVendorsAndModels } from "@/db/schema"
import { and, asc, eq } from "drizzle-orm"
import { DEFAULT_VENDOR_CIRCUIT_CONFIG } from "@/type"
import { hasLlmApiKey, isRegisteredLlmAdapter } from "./adapters/factory"
import type { LlmRoute } from "./types"

export async function listLlmRoutes(modelId: string): Promise<LlmRoute[]> {
  const rows = await db
    .select({
      modelId: llmModels.id,
      vendorName: llmVendors.name,
      adapter: llmVendors.adapter,
      apiName: llmVendorsAndModels.apiName,
      priority: llmVendorsAndModels.priority,
      circuitConfig: llmVendors.circuitConfig,
    })
    .from(llmVendorsAndModels)
    .innerJoin(llmModels, eq(llmModels.id, llmVendorsAndModels.modelId))
    .innerJoin(llmVendors, eq(llmVendors.id, llmVendorsAndModels.vendorId))
    .where(
      and(
        eq(llmVendorsAndModels.modelId, modelId),
        eq(llmModels.enabled, true),
        eq(llmVendors.enabled, true),
        eq(llmVendorsAndModels.enabled, true),
        eq(llmVendors.kind, "llm"),
      ),
    )
    .orderBy(asc(llmVendorsAndModels.priority), asc(llmVendors.name))

  const routes: LlmRoute[] = []
  for (const row of rows) {
    if (!isRegisteredLlmAdapter(row.adapter)) continue
    if (!hasLlmApiKey(row.vendorName)) continue
    const circuit = row.circuitConfig ?? DEFAULT_VENDOR_CIRCUIT_CONFIG
    routes.push({
      modelId: row.modelId,
      vendorName: row.vendorName,
      adapter: row.adapter,
      apiName: row.apiName,
      priority: row.priority,
      cooldownMs: circuit.cooldownMs,
    })
  }
  return routes
}
