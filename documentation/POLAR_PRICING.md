# Pricing subscriptions and credit packs in Polar

Use this worksheet when setting the fixed price and `creditAmount` metadata for a monthly plan, or the per-credit price and quantity bounds for a one-time unit-based top-up. For a top-up purchase, `N` is the number of units bought and `P` is the unit price multiplied by `N`; the fixed transaction fee applies to each purchase. For product setup and credit-grant behavior, see [Polar billing setup](./POLAR_BILLING.md).

## What the current credit calculation means

The API converts a generation's provider cost into credits using modality-specific overhead and `LOADED_COST_USD_PER_CREDIT = $0.003`. The unit is set in `[constants.ts](../apps/api/src/features/billing/constants.ts)`; the conversion is in `[credits.ts](../apps/api/src/features/billing/credits.ts)` and `[cost-utils.ts](../apps/api/src/features/media-engine/generators/cost-utils.ts)`. Video-editor exports use the same unit. The target margin and payment fees are accounted for when pricing Polar products, not when charging for a generation.

```text
loaded_cost_usd = provider_cost_usd × (1 + overhead_rate)
loaded_cost_usd_per_credit = $0.003
credits_charged = ceil(loaded_cost_usd ÷ loaded_cost_usd_per_credit)
```

The `$0.003` is a **loaded generation-cost budget per credit**, not the cash received for a credit. The effective selling price per credit varies across Polar products. Rounding up can make the realized cost per credit lower than the budget. Estimates reserve additional credits before settlement; the 15% estimate overbooking is not part of the final credit charge.

If any of these code settings change, recalculate the budget and every product below.

## Price for a target product margin

Define the target margin **after loaded usage cost and Polar transaction fees**, as a fraction of the product's pre-tax selling price. Assume every granted credit is spent. Let:

- `N` = credits granted per payment (`creditAmount` for a subscription, purchased units for a top-up).
- `B` = loaded cost budget per credit, currently `$0.003`.
- `m` = desired product margin, for example `0.70`.
- `v` = Polar's percentage transaction fee expressed as a decimal.
- `F` = Polar's fixed fee per transaction in dollars.
- `O` = any other cost per sale or billing period that is **not already included** in the loaded usage cost.
- `P` = pre-tax product price in dollars, after any discount.

```text
maximum_loaded_usage_cost = N × B
estimated_margin = (P − v × P − F − O − maximum_loaded_usage_cost) ÷ P
minimum_price = (N × B + F + O) ÷ (1 − m − v)
maximum_credits_at_price = floor(((1 − m − v) × P − F − O) ÷ B)
```

The denominator must be positive. Round a calculated minimum price **up**, then run the margin formula again using the actual price you enter in Polar. When setting an allowance, round down. A discount reduces `P`, so validate discounted prices separately. The fixed fee applies to every monthly payment, not just the initial subscription checkout.

Use the actual Polar fee assumption in `v` and `F`. There is no payment-fee reserve in the generation credit calculation.

## Credit allowances by price and margin

As of 2026-10-13, [Polar's published Starter pricing](https://polar.sh/resources/pricing) is **5% + $0.50 per transaction**. With `v = 0.05`, `F = $0.50`, `O = $0`, and `B = $0.003`:

```text
maximum_credits_at_price = floor(((1 − m − 0.05) × P − 0.50) ÷ 0.003)
```

Values below are the **maximum** credits to grant at that pre-tax price for the modeled margin if every credit is spent. Round down further for cleaner product numbers if needed.

| Price (`P`) | 70% margin | 65% margin | 60% margin | 55% margin |
| ----------- | ---------: | ---------: | ---------: | ---------: |
| $19         |      1,416 |      1,733 |      2,050 |      2,366 |
| $29         |      2,250 |      2,733 |      3,216 |      3,700 |
| $49         |      3,916 |      4,733 |      5,550 |      6,366 |
| $79         |      6,416 |      7,733 |      9,050 |     10,366 |

### Agreed monthly subscription ladder

Use these prices and `creditAmount` values when creating the four monthly subscription products in Polar. The margin figures use the Starter fee and cost assumptions above, with every included credit spent and no other per-period cost (`O = $0`). Savings compare the effective price per credit with the immediately cheaper plan; they are not a discount on the subscription price.

| Monthly price | `creditAmount` | Price per 1,000 credits | Modeled full-use margin | Savings vs. previous tier |
| ------------: | -------------: | ----------------------: | ----------------------: | ------------------------: |
|           $19 |          2,200 |                   $8.64 |                   57.6% |                         — |
|           $29 |          3,500 |                   $8.29 |                   57.1% |                      4.1% |
|           $49 |          6,200 |                   $7.90 |                   56.0% |                      4.6% |
|           $79 |         10,500 |                   $7.52 |                   54.5% |                      4.8% |

The $79 plan is slightly below a 55% modeled margin under these assumptions. Recheck each product at its actual price and fee mix before publishing, especially if discounts or additional fees apply. Polar remains the source of truth for the prices and allowances shown in the app's billing catalog.

### Rough generation capacity per credit bucket

Estimates use settled credit burns from catalog provider prices (no estimate overbooking):

- **Nano Banana Pro** image at default **1k**: provider `$0.14`, image overhead **10%** → `ceil(0.14 × 1.10 ÷ 0.003) = 52` credits per image
- **Seedance 2.0 Fast** video at defaults **5s / 720p**: provider `$1.00`, video overhead **15%** → `ceil(1.00 × 1.15 ÷ 0.003) = 384` credits per video

Counts are `floor(credits ÷ burn)` and assume the whole allowance is spent on that one modality.

| Monthly price | Credits | ≈ Nano Banana Pro images | ≈ Seedance 2.0 Fast videos |
| ------------: | ------: | -----------------------: | -------------------------: |
|           $19 |   2,200 |                       42 |                          5 |
|           $29 |   3,500 |                       67 |                          9 |
|           $49 |   6,200 |                      119 |                         16 |
|           $79 |  10,500 |                      201 |                         27 |

Higher resolution, longer duration, or other models change the burn. Recalculate from catalog pricing when those defaults change.

The earlier [`billing.md`](../billing.md) is a historical design report with different margin and payment-reserve assumptions. This worksheet uses the **current shared $0.003 cost unit in code**; use the agreed ladder above when setting monthly Polar products, and recalculate other products with the formulas here.

## Check before publishing or changing a product

1. Confirm the organization's current Polar fee tier and update `v` and `F`. Polar lists an additional 1.5% for international cards and other possible charges. Its percentage fee can apply to tax-inclusive transaction value, so `v × P` is a simplified estimate. Add an appropriate allowance or model the expected transaction mix and tax amounts explicitly.
2. Check the exact price customers will pay after discounts and the `creditAmount` they will receive. Include any additional grants or rollover arising from plan changes when assessing a billing period.
3. Check whether modality overhead estimates cover the real non-provider costs. Add remaining costs through `O`; do not count a cost twice.
4. Recompute when provider rates, code pricing settings, Polar fees, product prices, or allowances change. Once live, compare actual collected revenue and fees with actual generation costs. The formulas are planning estimates, not a guarantee of realized margin.
