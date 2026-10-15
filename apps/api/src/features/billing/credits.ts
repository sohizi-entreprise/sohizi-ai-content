import { LOADED_COST_USD_PER_CREDIT, TOKEN_OVERHEAD_RATE } from "./constants"
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
  loadedCostUsd: number,
  loadedCostUsdPerCredit = LOADED_COST_USD_PER_CREDIT,
) => {
  return Math.ceil(loadedCostUsd / loadedCostUsdPerCredit)
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

  if (pricing.unit === "per_inference") {
    return { unit: "per_inference", rate: pricing.rate * multiplier }
  }

  return {
    unit: "parameter_table",
    rate: pricing.rate.map((row) => ({
      ...row,
      usd: row.usd * multiplier,
    })),
  }
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

export const credits_to_charge = (
  loaded_cost_usd: number,
  loaded_cost_usd_per_credit = LOADED_COST_USD_PER_CREDIT,
) => {
  return Math.ceil(loaded_cost_usd / loaded_cost_usd_per_credit)
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

const pricingValueEquals = (expected: string | number, actual: unknown) => {
  if (actual == null) return false
  if (typeof expected === "number") {
    return Number(actual) === expected
  }
  return String(actual) === String(expected)
}

export const resolveMediaPricingParams = (
  payload: Record<string, unknown>,
  defaults: Array<{ key: string; defaultValue?: string | null }>,
) => {
  const params: Record<string, unknown> = {}

  for (const { key, defaultValue } of defaults) {
    const value = payload[key]
    if (value != null && value !== "") {
      params[key] = value
      continue
    }
    if (defaultValue != null && defaultValue !== "") {
      params[key] = defaultValue
    }
  }

  for (const [key, value] of Object.entries(payload)) {
    if (key === "modelId" || key === "model" || params[key] != null) {
      continue
    }
    if (value != null && value !== "") {
      params[key] = value
    }
  }

  return params
}

export const calculateMediaProviderCost = (
  model: PricedModel,
  params: Record<string, unknown> = {},
) => {
  const pricing = model.pricing
  if (!pricing) {
    throw new Error(`Model ${model.name} does not have pricing configured`)
  }

  if (pricing.unit === "per_inference") {
    return pricing.rate
  }

  if (pricing.unit === "parameter_table") {
    const match = pricing.rate.find((row) =>
      Object.entries(row.when).every(([key, expected]) =>
        pricingValueEquals(expected, params[key]),
      ),
    )
    if (!match) {
      const used = Object.entries(params)
        .map(([key, value]) => `${key}=${String(value)}`)
        .join(", ")
      throw new Error(
        `Model ${model.name} has no catalog price for ${used || "the given parameters"}`,
      )
    }
    return match.usd
  }

  throw new Error(`Unsupported pricing unit for media billing: ${pricing.unit}`)
}

export const calculateTextCredits = (
  model: PricedModel,
  usage: TextTokenUsage,
  options: {
    overheadRate?: number
    priceMultiplier?: number
  } = {},
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
  return credits_to_charge(loadedCostUsd)
}
