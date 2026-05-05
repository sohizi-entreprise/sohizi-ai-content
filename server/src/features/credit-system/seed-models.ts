import { db } from '@/db'
import { llmModels } from '@/db/schema'
import { sql } from 'drizzle-orm'
import type {
  ModelCategory,
  ModelRecommendedUsage,
  TokenPricing,
} from '@/type'

type SeedModel = {
  provider: string
  name: string
  apiName?: string
  category: ModelCategory[]
  recommended_usage?: ModelRecommendedUsage[]
  metadata?: Record<string, unknown>
  pricing: TokenPricing
  enabled?: boolean
}

const buildModelId = (provider: string, apiName: string) => {
  return `${provider}/${apiName}`
}

const normalizeApiName = (name: string) => {
  return name.toLowerCase()
}

const seedModels = async () => {
  const models = (await Bun.file(
    new URL('./seed-models.json', import.meta.url),
  ).json()) as SeedModel[]

  const values = models.map((model) => {
    const apiName = model.apiName ?? normalizeApiName(model.name)

    return {
      id: buildModelId(model.provider, apiName),
      provider: model.provider,
      name: model.name,
      apiName,
      category: model.category,
      recommendedUsage: model.recommended_usage,
      metadata: model.metadata,
      pricing: model.pricing,
      enabled: model.enabled ?? true,
    }
  })

  if (values.length === 0) {
    console.log('No models to seed.')
    return
  }

  await db
    .insert(llmModels)
    .values(values)
    .onConflictDoUpdate({
      target: llmModels.id,
      set: {
        provider: sql`excluded.provider`,
        name: sql`excluded.name`,
        apiName: sql`excluded.api_name`,
        category: sql`excluded.category`,
        recommendedUsage: sql`excluded.recommended_usage`,
        metadata: sql`excluded.metadata`,
        pricing: sql`excluded.pricing`,
        enabled: sql`excluded.enabled`,
      },
    })

  console.log(`Seeded ${values.length} model${values.length === 1 ? '' : 's'}.`)
}

seedModels()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed to seed models:', error)
    process.exit(1)
  })
