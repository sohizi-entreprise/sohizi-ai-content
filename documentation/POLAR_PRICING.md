# Pricing subscriptions and credit packs in Polar

Use this worksheet when setting the fixed price and `creditAmount` metadata for a monthly plan or one-time credit pack. The same calculation applies to each monthly subscription payment and each pack purchase. For product setup and credit-grant behavior, see [Polar billing setup](./POLAR_BILLING.md).

## What the current credit calculation means

The API converts a generation's provider cost into credits using modality-specific overhead and `LOADED_COST_USD_PER_CREDIT = $0.003`. The unit is set in [`constants.ts`](../apps/api/src/features/billing/constants.ts); the conversion is in [`credits.ts`](../apps/api/src/features/billing/credits.ts) and [`cost-utils.ts`](../apps/api/src/features/media-engine/generators/cost-utils.ts). Video-editor exports use the same unit. The target margin and payment fees are accounted for when pricing Polar products, not when charging for a generation.

```text
loaded_cost_usd = provider_cost_usd × (1 + overhead_rate)
loaded_cost_usd_per_credit = $0.003
credits_charged = ceil(loaded_cost_usd ÷ loaded_cost_usd_per_credit)
```

The `$0.003` is a **loaded generation-cost budget per credit**, not the cash received for a credit. The effective selling price per credit varies across Polar products. Rounding up can make the realized cost per credit lower than the budget. Estimates reserve additional credits before settlement; the 15% estimate overbooking is not part of the final credit charge.

If any of these code settings change, recalculate the budget and every product below.

## Price for a target product margin

Define the target margin **after loaded usage cost and Polar transaction fees**, as a fraction of the product's pre-tax selling price. Assume every granted credit is spent. Let:

- `N` = credits granted per payment (`creditAmount` in Polar).
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

## Worked examples: Polar Starter

As of 2026-10-13, [Polar's published Starter pricing](https://polar.sh/resources/pricing) is **5% + $0.50 per transaction**. With `m = 0.70`, `v = 0.05`, `F = $0.50`, and `O = $0`, the denominator is `1 − 0.70 − 0.05 = 0.25`:

```text
minimum_price = (credits × $0.003 + $0.50) ÷ 0.25
```

| Product example | Credits | Maximum loaded usage cost | Minimum price for 70% | Price in earlier `billing.md` |
| --- | ---: | ---: | ---: | ---: |
| Creator monthly | 2,500 | $7.50 | $32.00 | $29 |
| Studio monthly | 8,000 | $24.00 | $98.00 | $79 |
| Pro monthly | 22,000 | $66.00 | $266.00 | $199 |
| Small top-up | 1,000 | $3.00 | $14.00 | $15 |
| Medium top-up | 5,000 | $15.00 | $62.00 | $65 |
| Large top-up | 15,000 | $45.00 | $182.00 | $180 |

For example, a 22,000-credit Pro plan needs `(22,000 × $0.003 + $0.50) ÷ 0.25 = $266.00` under these assumptions. At the earlier `$199` price, the maximum allowance for a modeled 70% margin is `floor((0.25 × $199 − $0.50) ÷ $0.003) = 16,416` credits. All three earlier subscription prices and the earlier `$180` large-pack price fall below the 70% target if all credits are spent.

The earlier [`billing.md`](../billing.md) is a historical design report with different margin and payment-reserve assumptions. This worksheet uses the **current shared $0.003 cost unit in code** and a **70% target for each Polar product**; use these figures when setting current Polar prices.

## Check before publishing or changing a product

1. Confirm the organization's current Polar fee tier and update `v` and `F`. Polar lists an additional 1.5% for international cards and other possible charges. Its percentage fee can apply to tax-inclusive transaction value, so `v × P` is a simplified estimate. Add an appropriate allowance or model the expected transaction mix and tax amounts explicitly.
2. Check the exact price customers will pay after discounts and the `creditAmount` they will receive. Include any additional grants or rollover arising from plan changes when assessing a billing period.
3. Check whether modality overhead estimates cover the real non-provider costs. Add remaining costs through `O`; do not count a cost twice.
4. Recompute when provider rates, code pricing settings, Polar fees, product prices, or allowances change. Once live, compare actual collected revenue and fees with actual generation costs. The formulas are planning estimates, not a guarantee of realized margin.
