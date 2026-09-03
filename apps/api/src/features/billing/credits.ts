import { CREDIT_RATE, TOKEN_OVERHEAD_RATE } from "./constants"
import { ModelBasePricing, TextTokenUsage } from "@/type"

type PricedModel = {
  name: string
  pricing: ModelBasePricing | null
}

type BillingUnit =
  | "text"
  | "image"
  | "video/second"
  | "audio/minute"
  | "audio/1k characters"
  | "audio/generation"

const TOKENS_PER_PRICING_UNIT = 1_000_000

export const calculateCreditCost = (
  retailPriceUsd: number,
  creditRate = CREDIT_RATE,
) => {
  return Math.ceil(retailPriceUsd / creditRate)
}

export const productOfMultipliers = (
  multipliers: Array<number | null | undefined>,
) => {
  return multipliers.reduce<number>(
    (product, value) => product * (value ?? 1),
    1,
  )
}

export const applyPriceMultiplier = (
  pricing: ModelBasePricing,
  multiplier: number,
): ModelBasePricing => {
  if (multiplier === 1) {
    return pricing
  }

  if (pricing.unit === "per_1m_tokens") {
    return {
      unit: "per_1m_tokens",
      input: pricing.input * multiplier,
      output: pricing.output * multiplier,
      ...(pricing.cached_input != null
        ? { cached_input: pricing.cached_input * multiplier }
        : {}),
    }
  }

  return { unit: "per_inference", rate: pricing.rate * multiplier }
}

export const rawProviderCost = (
  model: PricedModel,
  unit: BillingUnit,
  usage: TextTokenUsage,
  priceMultiplier = 1,
) => {
  if (unit !== "text") {
    throw new Error(`Unsupported billing unit: ${unit}`)
  }

  const pricing = model.pricing

  if (!pricing) {
    throw new Error(`Model ${model.name} does not have pricing configured`)
  }

  return calculateTextProviderCost(pricing, usage, priceMultiplier)
}

export const loaded_cost_usd = (
  raw_provider_cost_usd: number,
  overhead_rate: number,
) => {
  return raw_provider_cost_usd * (1 + overhead_rate)
}

export const retail_price_usd = (
  loaded_cost_usd: number,
  target_margin: number,
  payment_fee_reserve: number,
) => {
  return loaded_cost_usd / (1 - target_margin - payment_fee_reserve)
}

export const credits_to_charge = (
  retail_price_usd: number,
  credit_rate: number,
) => {
  return Math.ceil(retail_price_usd / credit_rate)
}

export const calculateTextProviderCost = (
  pricing: ModelBasePricing,
  usage: TextTokenUsage,
  priceMultiplier = 1,
) => {
  if (pricing.unit !== "per_1m_tokens") {
    throw new Error(
      `Unsupported pricing unit for text billing: ${pricing.unit}`,
    )
  }

  const effective = applyPriceMultiplier(pricing, priceMultiplier)
  if (effective.unit !== "per_1m_tokens") {
    throw new Error(
      `Unsupported pricing unit for text billing: ${effective.unit}`,
    )
  }

  const cachedInputTokens = usage.cachedInputTokens ?? 0
  const uncachedInputTokens = Math.max(usage.inputTokens - cachedInputTokens, 0)
  const cachedInputRate = effective.cached_input ?? effective.input

  return (
    (uncachedInputTokens / TOKENS_PER_PRICING_UNIT) * effective.input +
    (cachedInputTokens / TOKENS_PER_PRICING_UNIT) * cachedInputRate +
    (usage.outputTokens / TOKENS_PER_PRICING_UNIT) * effective.output
  )
}

export const calculateTextCredits = (
  model: PricedModel,
  usage: TextTokenUsage,
  options: {
    overheadRate?: number
    targetMargin: number
    paymentFeeReserve: number
    creditRate?: number
    priceMultiplier?: number
  },
) => {
  const rawCostUsd = rawProviderCost(
    model,
    "text",
    usage,
    options.priceMultiplier ?? 1,
  )
  const loadedCostUsd = loaded_cost_usd(
    rawCostUsd,
    options.overheadRate ?? TOKEN_OVERHEAD_RATE,
  )
  const retailPriceUsd = retail_price_usd(
    loadedCostUsd,
    options.targetMargin,
    options.paymentFeeReserve,
  )

  return credits_to_charge(retailPriceUsd, options.creditRate ?? CREDIT_RATE)
}
