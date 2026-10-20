import { db } from "@/db"
import { llmModels, llmVendors, llmVendorsAndModels } from "@/db/schema"
import { and, asc, eq } from "drizzle-orm"
import { getProvider, resolveProviderAccounts } from "./registry"

export type CapacityBinding = {
  providerName: string
  adapter: string
  apiName: string
  priority: number
}

async function listBindings(
  modelId: string,
  kind: "llm" | "media",
): Promise<CapacityBinding[]> {
  const rows = await db
    .select({
      vendorName: llmVendors.name,
      adapter: llmVendors.adapter,
      apiName: llmVendorsAndModels.apiName,
      priority: llmVendorsAndModels.priority,
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
        eq(llmVendors.kind, kind),
      ),
    )
    .orderBy(asc(llmVendorsAndModels.priority), asc(llmVendors.name))

  const bindings: CapacityBinding[] = []
  for (const row of rows) {
    const provider = getProvider(row.vendorName)
    if (!provider || provider.adapter !== row.adapter) continue
    if (!provider.tasks.includes(kind)) continue
    if (resolveProviderAccounts(provider.name).length === 0) continue
    bindings.push({
      providerName: row.vendorName,
      adapter: provider.adapter,
      apiName: row.apiName,
      priority: row.priority,
    })
  }
  return bindings
}

export function listLlmBindings(modelId: string): Promise<CapacityBinding[]> {
  return listBindings(modelId, "llm")
}

export function listMediaBindings(modelId: string): Promise<CapacityBinding[]> {
  return listBindings(modelId, "media")
}
