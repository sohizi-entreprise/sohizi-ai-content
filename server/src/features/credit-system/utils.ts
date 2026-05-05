import type { LlmModel } from "@/db/schema";
import { CREDIT_RATE, TOKEN_OVERHEAD_RATE } from "./constants";
import { TokenPricing, TextTokenUsage, PricingTier } from "@/type";

type BillingUnit = 'text' | 'image' | 'video/second' | 'audio/minute' | 'audio/1k characters' | 'audio/generation';

const TOKENS_PER_PRICING_UNIT = 1_000_000;

export const calculateCreditCost = (retailPriceUsd: number, creditRate = CREDIT_RATE) => {
  return Math.ceil(retailPriceUsd / creditRate);
}

export const calculateProviderRatePer1M = (
  pricing: TokenPricing,
  direction: keyof Pick<TokenPricing, "input" | "output" | "cached_input">,
  basisTokens: number,
) => {
  const tiers = pricing[direction];

  if (!tiers || tiers.length === 0) {
    return 0;
  }

  return getTierRate(tiers, basisTokens);
}

export const rawProviderCost = (
  model: LlmModel,
  unit: BillingUnit,
  usage: TextTokenUsage,
) => {
  if (unit !== 'text') {
    throw new Error(`Unsupported billing unit: ${unit}`);
  }

  const pricing = model.pricing as TokenPricing | null;

  if (!pricing) {
    throw new Error(`Model ${model.name} does not have pricing configured`);
  }

  return calculateTextProviderCost(pricing, usage);
}

export const loaded_cost_usd = (raw_provider_cost_usd: number, overhead_rate: number) => {
  return raw_provider_cost_usd * (1 + overhead_rate)
}

export const retail_price_usd = (loaded_cost_usd: number, target_margin: number, payment_fee_reserve: number) => {
  return loaded_cost_usd / (1 - target_margin - payment_fee_reserve)
}

export const credits_to_charge = (retail_price_usd: number, credit_rate: number) => {
  return Math.ceil(retail_price_usd / credit_rate)
}

export const calculateTextProviderCost = (
  pricing: TokenPricing,
  usage: TextTokenUsage,
) => {
  const cachedInputTokens = usage.cachedInputTokens ?? 0;
  const uncachedInputTokens = Math.max(usage.inputTokens - cachedInputTokens, 0);
  const basisTokens = getPricingBasisTokens(pricing, usage);

  const inputRate = calculateProviderRatePer1M(pricing, "input", basisTokens);
  const outputRate = calculateProviderRatePer1M(pricing, "output", basisTokens);
  const cachedInputRate = pricing.cached_input
    ? calculateProviderRatePer1M(pricing, "cached_input", basisTokens)
    : inputRate;

  return (
    (uncachedInputTokens / TOKENS_PER_PRICING_UNIT) * inputRate +
    (cachedInputTokens / TOKENS_PER_PRICING_UNIT) * cachedInputRate +
    (usage.outputTokens / TOKENS_PER_PRICING_UNIT) * outputRate
  );
}

export const calculateTextCredits = (
  model: LlmModel,
  usage: TextTokenUsage,
  options: {
    overheadRate?: number;
    targetMargin: number;
    paymentFeeReserve: number;
    creditRate?: number;
  },
) => {
  const rawCostUsd = rawProviderCost(model, 'text', usage);
  const loadedCostUsd = loaded_cost_usd(
    rawCostUsd,
    options.overheadRate ?? TOKEN_OVERHEAD_RATE,
  );
  const retailPriceUsd = retail_price_usd(
    loadedCostUsd,
    options.targetMargin,
    options.paymentFeeReserve,
  );

  return credits_to_charge(retailPriceUsd, options.creditRate ?? CREDIT_RATE);
}

const getTierRate = (tiers: PricingTier[], basisTokens: number) => {
  const tier = tiers.find((item) => item.up_to === null || basisTokens <= item.up_to);

  if (!tier) {
    throw new Error(`No pricing tier found for ${basisTokens} tokens`);
  }

  return tier.rate;
}

const getPricingBasisTokens = (pricing: TokenPricing, usage: TextTokenUsage) => {
  switch (pricing.basis ?? "request_tokens") {
    case "request_tokens":
      return usage.inputTokens + usage.outputTokens;
    case "billable_tokens":
      return (
        Math.max(usage.inputTokens - (usage.cachedInputTokens ?? 0), 0) +
        (usage.cachedInputTokens ?? 0) +
        usage.outputTokens
      );
  }
}
