# Billing Report

## Objective

Design a billing system for AI-generated text, image, video, and audio that:

- uses one universal credit wallet
- maps credits directly from provider cost
- protects margin
- stays understandable for end users
- works with multiple providers and changing provider prices

This report focuses only on billing and pricing logic.

## Executive Recommendation

Use a **universal credit system** with this rule:

- **1 credit = $0.01 of user-facing list value**

Do **exact cost metering internally**, but publish **simple rounded credit burns** to users:

- text: per request, based on real token usage
- image: per image, based on model and resolution
- video: per second
- audio: per minute, per 1K characters, or per generation depending on provider

This gives you one pricing language across providers while still letting provider choice affect billing.

## Core Billing Logic

### 1. Provider Cost

First compute the raw provider cost.

### Text

```text
provider_cost_usd =
  (input_tokens / 1_000_000 * input_rate_per_1m)
  + (cached_input_tokens / 1_000_000 * cached_input_rate_per_1m)
  + (output_tokens / 1_000_000 * output_rate_per_1m)
```

### Image

```text
provider_cost_usd =
  image_count * rate_per_image
```

or, if a provider bills by output size:

```text
provider_cost_usd =
  megapixels * rate_per_megapixel
```

### Video

```text
provider_cost_usd =
  duration_seconds * rate_per_second
```

### Audio

```text
provider_cost_usd =
  duration_minutes * rate_per_minute
```

or:

```text
provider_cost_usd =
  (characters / 1_000) * rate_per_1k_characters
```

or:

```text
provider_cost_usd =
  generation_count * rate_per_generation
```

## 2. Loaded Cost

Provider price alone is not enough. You also need to cover:

- orchestration and compute overhead
- storage and CDN costs for media
- failed job refunds
- abuse and retry buffer
- payment processing

Recommended default assumptions for a first version:

- text overhead reserve: **20%**
- image overhead reserve: **25%**
- audio overhead reserve: **25%**
- video overhead reserve: **30%**
- payment fee reserve: **3% of revenue**

Use these formulas:

```text
loaded_cost_usd = provider_cost_usd * (1 + overhead_rate)
```

```text
retail_price_usd = loaded_cost_usd / (1 - target_margin - payment_fee_rate)
```

For your business, I recommend:

- **60% target gross margin** for subscription-included credits
- **70% target gross margin** for top-up credits

That means:

### Subscription credit pricing target

```text
retail_price_usd = loaded_cost_usd / (1 - 0.60 - 0.03)
retail_price_usd = loaded_cost_usd / 0.37
```

### Top-up credit pricing target

```text
retail_price_usd = loaded_cost_usd / (1 - 0.70 - 0.03)
retail_price_usd = loaded_cost_usd / 0.27
```

## 3. Credit Burn Formula

After computing the retail price, convert it into credits:

```text
credits_to_charge = ceil(retail_price_usd / 0.01)
```

Recommended guardrails:

- minimum charge per successful request: **1 credit**
- round up, never round down
- store both `provider_cost_usd` and `credits_charged` on every billing event
- auto-refund credits for technical failures

## Public Pricing Anchors Used

These are representative public prices and should live in a configurable pricing registry, not in hardcoded business logic.

### OpenAI

- GPT-5.4: `$2.50 / 1M input tokens`, `$15.00 / 1M output tokens`
- GPT-5.4 mini: `$0.75 / 1M input tokens`, `$4.50 / 1M output tokens`
- GPT-realtime-1.5 audio: `$32.00 input`, `$64.00 output` per 1M audio tokens
- GPT-image-1.5: multimodal image pricing exists and should be handled as its own model family

Source: [OpenAI API pricing](https://openai.com/api/pricing)

### fal

- image models commonly around `$0.03` to `$0.04` per image at the normalized sizes shown
- video models commonly around `$0.05` to `$0.40` per second depending on model

Source: [fal pricing](https://www.fal.ai/pricing)

### Runway

- credits cost `$0.01` each
- Gen-4 Turbo: `5 credits / second` = `$0.05 / second`
- Gen-4.5: `12 credits / second` = `$0.12 / second`
- Veo 3.1 Fast with audio: `15 credits / second` = `$0.15 / second`

Source: [Runway API pricing](https://docs.dev.runwayml.com/guides/pricing/)

### ElevenLabs

- Flash / Turbo TTS: `$0.06 / 1K characters`
- Multilingual TTS: `$0.12 / 1K characters`
- Scribe STT: `$0.22 / hour`
- Music: `$0.28 / minute`
- Sound effects: `$0.07 / generation`

Source: [ElevenLabs API pricing](https://elevenlabs.io/pricing/api)

## Recommended Billing Model

### Universal Credits

Use one wallet for everything:

- text generation
- image generation
- video generation
- sound generation
- speech generation
- transcription

Why this is the right choice:

- it keeps UX simple
- it avoids separate wallets by modality
- it lets you compare all providers with one internal formula
- it lets you update burn rates when vendors change pricing

### What Users Should See

Users should not see raw provider formulas. They should see:

- current credit balance
- estimated credit burn before running a job
- actual credit charge after completion
- refunded credits if a technical failure occurs

### What Your Backend Should Store

Every billable event should store:

- provider
- model
- modality
- metered units
- provider cost in USD
- overhead rate applied
- target margin applied
- retail USD equivalent
- credits charged
- refund status

## Example Credit Burn Mapping

These examples show how the formula behaves using the assumptions above.

### Example A: Text, GPT-5.4 mini

Request:

- 2,000 input tokens
- 500 output tokens

Provider cost:

```text
(2_000 / 1_000_000 * 0.75) + (500 / 1_000_000 * 4.50)
= 0.0015 + 0.00225
= $0.00375
```

Loaded cost with 20% overhead:

```text
$0.00375 * 1.20 = $0.00450
```

Retail at 60% margin plus 3% payment reserve:

```text
$0.00450 / 0.37 = $0.01216
```

User charge:

```text
ceil(0.01216 / 0.01) = 2 credits
```

### Example B: Image, fal at $0.04 per image

Provider cost:

```text
$0.04
```

Loaded cost with 25% overhead:

```text
$0.04 * 1.25 = $0.05
```

Retail at 60% margin plus 3% payment reserve:

```text
$0.05 / 0.37 = $0.1351
```

User charge:

```text
ceil(0.1351 / 0.01) = 14 credits
```

### Example C: Video, Runway Gen-4 Turbo

Provider cost per second:

```text
$0.05
```

Loaded cost with 30% overhead:

```text
$0.05 * 1.30 = $0.065
```

Retail at 60% margin plus 3% payment reserve:

```text
$0.065 / 0.37 = $0.1757
```

User charge:

```text
ceil(0.1757 / 0.01) = 18 credits per second
```

So a 5-second video is about:

```text
5 * 18 = 90 credits
```

### Example D: Audio, ElevenLabs sound effects

Provider cost:

```text
$0.07 per generation
```

Loaded cost with 25% overhead:

```text
$0.07 * 1.25 = $0.0875
```

Retail at 60% margin plus 3% payment reserve:

```text
$0.0875 / 0.37 = $0.2365
```

User charge:

```text
ceil(0.2365 / 0.01) = 24 credits per generation
```

## Pricing Rules I Recommend

### 1. Keep Burn Dynamic, Not Credit Price

Do not change the dollar meaning of a credit often.

Instead:

- keep `1 credit = $0.01` as your stable internal list value
- update model burn rates when provider pricing changes

This is much easier for users to understand.

### 2. Charge More for Top-Ups Than Included Credits

This matches your goal and improves margin protection.

Recommendation:

- subscription plans: better effective credit rate
- top-up packs: more expensive per credit

Suggested top-up pricing:

- `1,000 credits = $15`
- `5,000 credits = $65`
- `15,000 credits = $180`

### 3. Split Billing Into Estimate And Settlement

Before generation:

- estimate the credit cost
- verify the user has enough balance

After generation:

- settle based on actual usage
- refund the difference if final usage is lower than estimate
- fully refund on technical failure

### 4. Included Credits Should Expire Monthly

For B2C, I recommend:

- subscription credits expire monthly
- top-up credits remain valid for 12 months

This reduces long-term balance liability while still feeling fair.

## Recommended 3-Pack Pricing Line

These are the three package prices I recommend for launch.

### Package 1: Creator

- **$29 / month**
- **2,500 credits included**
- effective rate: **$0.0116 per included credit**

Best for:

- light-to-moderate text use
- occasional image generation
- short video experiments

### Package 2: Studio

- **$79 / month**
- **8,000 credits included**
- effective rate: **$0.0099 per included credit**

Best for:

- regular image generation
- meaningful text usage
- consistent short-form video generation

### Package 3: Pro

- **$199 / month**
- **22,000 credits included**
- effective rate: **$0.0090 per included credit**

Best for:

- heavy weekly usage
- frequent media generation
- users who need video and audio often

## What These Packages Mean In Practice

Using the example burns above, rough buying power looks like this:

### Creator

- about `1,250` GPT-5.4 mini example requests at `2 credits` each
- or about `178` fal images at `14 credits` each
- or about `138` seconds of Gen-4 Turbo video at `18 credits/sec`

### Studio

- about `4,000` GPT-5.4 mini example requests
- or about `571` fal images
- or about `444` seconds of Gen-4 Turbo video

### Pro

- about `11,000` GPT-5.4 mini example requests
- or about `1,571` fal images
- or about `1,222` seconds of Gen-4 Turbo video

## Final Recommendation

If you want the billing system to be effective, simple, and margin-protective, launch with:

- one universal credit wallet
- `1 credit = $0.01` list value
- burn rates computed from provider cost plus modality-specific overhead
- 60% target margin on subscription-included usage
- 70% target margin on top-ups
- monthly plans at **$29**, **$79**, and **$199**
- top-up packs priced above the subscription effective rate

This setup is simple enough for users to understand and strong enough for you to adapt as provider pricing changes.
