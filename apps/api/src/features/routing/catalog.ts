import { db } from '@/db'
import { llmModels, llmVendors, llmVendorsAndModels } from '@/db/schema'
import { and, asc, eq } from 'drizzle-orm'
import {
  DEFAULT_VENDOR_CIRCUIT_CONFIG,
  DEFAULT_VENDOR_RATE_LIMIT,
} from '@/type'
import {
  hasProviderApiKey,
  isRegisteredMediaVendor,
} from '@/features/media-engine/providers/factory'
import type { MediaRoute } from './types'

function burstOf(rpm: number, burst?: number): number {
  return burst && burst > 0 ? burst : rpm
}

export async function listMediaRoutes(modelId: string): Promise<MediaRoute[]> {
  const rows = await db
    .select({
      modelId: llmModels.id,
      vendorName: llmVendors.name,
      apiName: llmVendorsAndModels.apiName,
      priority: llmVendorsAndModels.priority,
      rateLimit: llmVendors.rateLimit,
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
        eq(llmVendors.kind, 'media'),
      ),
    )
    .orderBy(asc(llmVendorsAndModels.priority), asc(llmVendors.name))

  const routes: MediaRoute[] = []
  for (const row of rows) {
    if (!isRegisteredMediaVendor(row.vendorName)) continue
    if (!hasProviderApiKey(row.vendorName)) continue

    const rateLimit = row.rateLimit ?? DEFAULT_VENDOR_RATE_LIMIT
    const circuit = row.circuitConfig ?? DEFAULT_VENDOR_CIRCUIT_CONFIG
    routes.push({
      modelId: row.modelId,
      vendorName: row.vendorName,
      apiName: row.apiName,
      priority: row.priority,
      rpm: rateLimit.rpm,
      burst: burstOf(rateLimit.rpm, rateLimit.burst),
      maxConcurrency: rateLimit.maxConcurrency,
      cooldownMs: circuit.cooldownMs,
      probeTtlMs: circuit.probeTtlMs,
    })
  }
  return routes
}
