import {
  AUDIO_OVERHEAD_RATE,
  IMAGE_OVERHEAD_RATE,
  VIDEO_OVERHEAD_RATE,
} from "@/features/billing/constants"
import {
  calculateMediaProviderCost,
  resolveMediaPricingParams,
} from "@/features/billing/credits"
import { providerCostToCredits } from "./generators/cost-utils"
import {
  getModelById,
  listModelParameterBindings,
} from "@/features/models/repo"

type ProviderMediaType = "image" | "video" | "audio"

export function mediaOverheadRate(mediaType: ProviderMediaType): number {
  if (mediaType === "video") return VIDEO_OVERHEAD_RATE
  if (mediaType === "audio") return AUDIO_OVERHEAD_RATE
  return IMAGE_OVERHEAD_RATE
}

export const estimateCatalogMediaCostUsd = async (
  modelId: string,
  payload: Record<string, unknown>,
) => {
  const model = await getModelById(modelId)
  if (!model) {
    throw new Error(`Unknown model ${modelId}`)
  }

  const { bindings } = await listModelParameterBindings(modelId)
  const params = resolveMediaPricingParams(
    payload,
    bindings.map((binding) => ({
      key: binding.key,
      defaultValue: binding.defaultValue,
    })),
  )

  return calculateMediaProviderCost(
    { name: model.name, pricing: model.pricing },
    params,
  )
}

export const estimateCatalogMediaCredits = async (
  modelId: string,
  payload: Record<string, unknown>,
  mediaType: ProviderMediaType,
) => {
  const priceUsd = await estimateCatalogMediaCostUsd(modelId, payload)
  return Number(
    providerCostToCredits(priceUsd, {
      overheadRate: mediaOverheadRate(mediaType),
    }),
  )
}
