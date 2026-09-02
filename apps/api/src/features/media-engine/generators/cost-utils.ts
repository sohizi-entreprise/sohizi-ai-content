import {
  CREDIT_RATE,
  ESTIMATE_OVERBOOKING_FACTOR,
  TOPUP_TARGET_MARGIN,
  PAYMENT_FEE_RESERVE,
} from '@/features/billing/constants'
import {
  credits_to_charge,
  loaded_cost_usd,
  retail_price_usd,
} from '@/features/billing/credits'
import { LUMEN_BASE_URL } from '@/features/media-engine/constants'

export type LumenDryRunComponent = {
  type: string
  metric: string
  quantity: number
  billable_quantity: number
  unit_price: number
  total_cost: number
}

export type LumenDryRunResponse = {
  estimated: true
  model: string
  provider: string
  total_cost_micros: number
  currency: string
  components: LumenDryRunComponent[]
}

export const microsToDollars = (micros: number): number => micros / 1_000_000

/**
 * Call a Lumenfall endpoint with `?dryRun=true` to get a cost estimate
 * without executing the request. Returns the parsed estimate or `null`
 * if the endpoint did not return an estimate (we fall back to a static
 * estimate in that case).
 */
export const lumenDryRun = async (
  path: string,
  body: Record<string, unknown>,
): Promise<LumenDryRunResponse | null> => {
  const url = `${LUMEN_BASE_URL}${path}${path.includes('?') ? '&' : '?'}dryRun=true`
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.LUMEN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      return null
    }
    const data = (await response.json()) as LumenDryRunResponse
    if (
      !data ||
      data.estimated !== true ||
      typeof data.total_cost_micros !== 'number'
    ) {
      return null
    }
    return data
  } catch (error) {
    console.error('[lumenDryRun] failed', error)
    return null
  }
}

export type CreditConversionOptions = {
  overheadRate: number
  targetMargin?: number
  paymentFeeReserve?: number
  creditRate?: number
  overbookingFactor?: number
}

/**
 * Convert a raw provider USD cost into credits using the standard billing
 * formula: overhead -> margin -> credit rate -> ceil. Applies the overbooking
 * factor on top so estimates reserve a bit more than expected actual.
 */
export const providerCostToCredits = (
  providerCostUsd: number,
  options: CreditConversionOptions,
): bigint => {
  const overhead = options.overheadRate
  const margin = options.targetMargin ?? TOPUP_TARGET_MARGIN
  const fee = options.paymentFeeReserve ?? PAYMENT_FEE_RESERVE
  const rate = options.creditRate ?? CREDIT_RATE
  const overbook = options.overbookingFactor ?? ESTIMATE_OVERBOOKING_FACTOR

  const loaded = loaded_cost_usd(providerCostUsd, overhead)
  const retail = retail_price_usd(loaded, margin, fee)
  const baseCredits = credits_to_charge(retail, rate)
  const overbooked = Math.ceil(baseCredits * overbook)
  return BigInt(Math.max(overbooked, 1))
}

/**
 * Same as providerCostToCredits but with no overbooking (used for the
 * actual `settle` amount on completion).
 */
export const providerCostToActualCredits = (
  providerCostUsd: number,
  options: Omit<CreditConversionOptions, 'overbookingFactor'>,
): bigint => {
  return providerCostToCredits(providerCostUsd, {
    ...options,
    overbookingFactor: 1,
  })
}
