# API

Model and parameter vocabulary lives in [`src/catalog/README.md`](src/catalog/README.md). This file covers how a **vendor** is wired so generation can call it.

A vendor is an account. An adapter is the code that talks to that account's API. Two WaveSpeed keys are two vendors that share the `wavespeed` adapter.

```
vendor name: wavespeed-b  →  WAVESPEED_B_API_KEY
adapter:     wavespeed    →  WaveSpeedProvider
```

## Current vendors

| File                                                                                 | Name             | Adapter          | Kind  |
| ------------------------------------------------------------------------------------ | ---------------- | ---------------- | ----- |
| [`src/catalog/vendors/wavespeed.yaml`](src/catalog/vendors/wavespeed.yaml)           | `wavespeed`      | `wavespeed`      | media |
| [`src/catalog/vendors/openrouter.yaml`](src/catalog/vendors/openrouter.yaml)         | `openrouter`     | `openrouter`     | llm   |
| [`src/catalog/vendors/vercel-gateway.yaml`](src/catalog/vendors/vercel-gateway.yaml) | `vercel-gateway` | `vercel-gateway` | llm   |

Media adapters are registered in [`src/features/media-engine/providers/factory.ts`](src/features/media-engine/providers/factory.ts). The API key is `{VENDOR_NAME}_API_KEY` with hyphens turned into underscores (`wavespeed-b` → `WAVESPEED_B_API_KEY`).

A media route is used only when the model, vendor, and binding are enabled, the adapter is registered, and that vendor's env key is set. Routes are tried in ascending `priority` (lower number first). Rate-limit, unavailable, and account errors fail over to the next vendor. `media-generate` then retries a retriable error once.

## Add another account on an existing adapter

Use this when the implementation already exists and you only need a second key.

1. Add `src/catalog/vendors/{name}.yaml` with a new `name`, the same `adapter`, `kind: media` or `kind: llm`, model bindings, and parameter maps.
2. Set `{NAME}_API_KEY` in the environment.
3. Run `bun run catalog:validate` then `bun run catalog:populate`.

Example: a second WaveSpeed account.

```yaml
id: vendor_wavespeed_b
name: wavespeed-b
adapter: wavespeed
kind: media
rateLimit: { rpm: 60, burst: 60, maxConcurrency: 10 }
circuitConfig: { cooldownMs: 15000, probeTtlMs: 30000 }
models:
  - {
      id: openai/gpt-image-2/text-to-image,
      apiName: openai/gpt-image-2/text-to-image,
      priority: 20,
    }
```

`priority` is compared across every vendor that binds the same model. The lowest number is tried first.

## Add a new media adapter

Use this when the HTTP API is new. The routing, limiter, billing, and upload path stay the same.

### 1. Implement the adapter

Add a class next to [`src/features/media-engine/providers/wave-speed.ts`](src/features/media-engine/providers/wave-speed.ts) that implements `MediaEngineProvider` from [`src/features/media-engine/providers/type.ts`](src/features/media-engine/providers/type.ts):

- `submitRequest(apiName, payload)` — start the job, return `{ requestId, status: "created" }`
- `getRequestData(requestId)` — poll. Completed jobs return `{ status: "completed", data }` with output URLs. Failed, cancelled, or timed-out jobs return `{ status: "error", error }`, not an exception
- `cancelRequest(requestId)`
- `estimateRequestPrice(apiName, payload)`

The constructor takes the API key. The factory instantiates it.

Register the class in `PROVIDER_CLASSES` in `factory.ts`. The key is the adapter slug (`fal`, `replicate`), not the vendor name.

### 2. Throw the shared media errors

Do not invent vendor-specific error classes. Map HTTP and API failures onto the types in `providers/type.ts`:

| Error                          | When                                                                   | Fail over | Inngest retry |
| ------------------------------ | ---------------------------------------------------------------------- | --------- | ------------- |
| `MediaValidationError`         | Bad payload (400)                                                      | no        | no            |
| `MediaRateLimitError`          | Rate limit (429). Set `retryAfterMs` when the vendor sends it          | yes       | yes           |
| `MediaServiceUnavailableError` | 500 or the request times out                                           | yes       | yes           |
| `MediaAccountError`            | Unauthorized or exhausted account (401)                                | yes       | yes           |
| `MediaProviderError`           | Anything else, including an unexpected job status                      | no        | no            |
| `MediaConfigurationError`      | Missing key or unknown adapter. Thrown by the factory, not the adapter | no        | no            |

`media-generate` retries a retriable error once. `onFailure` refunds after that retry is used.

The payload mapper only **renames** keys and option values (`generate_audio` → `sound`). It cannot reshape a body into nested objects or multipart. If the vendor API is not a flat JSON submit-and-poll, the adapter must do that translation itself.

### 3. Declare the vendor in the catalog

1. Confirm each model exists in `src/catalog/models/*.yaml`. Add missing models first; see [`src/catalog/README.md`](src/catalog/README.md).
2. Add `src/catalog/vendors/{name}.yaml`:

```yaml
id: vendor_fal
name: fal
adapter: fal
kind: media
rateLimit: { rpm: 60, burst: 60, maxConcurrency: 10 }
circuitConfig: { cooldownMs: 15000, probeTtlMs: 30000 }
models:
  - {
      id: openai/gpt-image-2/text-to-image,
      apiName: fal-ai/gpt-image-2,
      priority: 50,
    }
parametersMapping:
  parameter_prompt: { vendorParamName: prompt }
  parameter_resolution:
    vendorParamName: image_size
    optionMapping:
      option_resolution_1k: { value: 1k, mappedValue: "1024x1024" }
```

3. `adapter` must match the slug registered in `factory.ts`.
4. `apiName` is the vendor's endpoint id, not our catalog model id.
5. Map every parameter that vendor sends. Use `modelParameterOverrides` only when one endpoint uses a different field name.

### 4. Load it

```bash
bun run catalog:validate
bun run catalog:populate
```

`catalog:populate` inserts missing rows and leaves existing ones unchanged (parameters are the exception and are updated). `catalog:overwrite` updates every catalog-owned column when the id already exists, and deletes catalog rows the files no longer contain, so the database matches the YAML. It does not change `enabled` on models, vendors, or vendor bindings.

Set `{NAME}_API_KEY`. A media vendor created in admin must pick a registered adapter; the name stays the account slug.

## Add an LLM vendor

LLM vendors do not use `MediaEngineProvider`. Text calls go through `LlmAdapter` in `src/features/ai/llm/`. Each adapter implements `generateText` and `streamText` with the AI SDK. Registered adapters are `openrouter` and `vercel-gateway`.

1. Add `src/catalog/vendors/{name}.yaml` with `kind: llm`, a registered `adapter`, and bindings for the models that account serves. `apiName` is that vendor's model id.
2. Set `{NAME}_API_KEY` (`vercel-gateway` → `VERCEL_GATEWAY_API_KEY`).
3. Routes for one catalog model are tried in ascending `priority` (lower number first). A 429, 408, 502, 503, 504, or network failure before any output cools that vendor+model in Redis and tries the next route. A 400 does not fail over. A stream that has already emitted text stays on the vendor that produced it.
4. Run `bun run catalog:validate` then `bun run catalog:populate`.

The gateway catalog binds the same text models as OpenRouter, at priority 200, so OpenRouter (priorities 65–100) stays primary and the gateway is the fallback.

## Check after any vendor change

- `bun run catalog:validate` passes
- Every bound model id exists
- Media `adapter` is in `PROVIDER_CLASSES`
- `{NAME}_API_KEY` is set in the environment that should use that account
- A second account for the same API reuses the adapter and only changes `name` and the key

---

## Scratch

Awesome resource to keep in mind:

1. Piper TTS - Free narration - text-to-speech - human sounding
2. ppp

Video editor main features:
---

[] Subtitle/caption
[] Transitions between clips
[] Audio mixing controls
[] Text & graphix overlays
[] undo/ redo
[] split clip
[] zoom timeline
[] View video full screen
[] clone or duplicate clip
[] drag and drop
[] reorder track
[] move clip to different track

Production ready features:
---

[] Server-side video rendering

Effects/transitions, keyframing, captions auto-gen.

Read this:
https://www.aimagicx.com/blog/long-form-ai-video-character-consistency-guide-2026
