import {
  MediaRateLimitError,
  MediaServiceUnavailableError,
  MediaValidationError,
  isMediaError,
} from '@/features/media-engine/errors'
import {
  createProvider,
  type MediaProviderFactory,
} from '@/features/media-engine/providers/factory'
import type {
  GetRequestDataResponse,
  SubmitPayload,
} from '@/features/media-engine/providers/type'
import { mapVendorPayload } from '@/features/media-engine/providers/utils'
import { listMediaRoutes } from './catalog'
import { AllVendorsSaturatedError, NoRouteError } from './errors'
import { limiter as defaultLimiter, type VendorLimiter } from './limiter'
import type { RouteDecision, StickyDecision } from './types'

const MAX_FAILOVER_ATTEMPTS = 3

export type ResolveOptions = {
  modelId: string
  requestId: string
  payload: SubmitPayload
  exclude?: string[]
  leaseTtlMs: number
  limiter?: VendorLimiter
  mapPayload?: typeof mapVendorPayload
}

export type SubmitWithFailoverOptions = ResolveOptions & {
  createProvider?: MediaProviderFactory
}

function retryAfterMsFrom(error: unknown): number {
  if (error instanceof MediaRateLimitError && error.retryAfterMs != null) {
    return error.retryAfterMs
  }
  return 15_000
}

function isFailoverError(error: unknown): boolean {
  return (
    error instanceof MediaRateLimitError ||
    error instanceof MediaServiceUnavailableError
  )
}

export async function resolveAndAcquire(
  options: ResolveOptions,
): Promise<RouteDecision> {
  const vendorLimiter = options.limiter ?? defaultLimiter
  const mapPayload = options.mapPayload ?? mapVendorPayload
  const exclude = new Set(options.exclude ?? [])

  const routes = (await listMediaRoutes(options.modelId)).filter(
    (route) => !exclude.has(route.vendorName),
  )

  if (routes.length === 0) {
    throw new NoRouteError(options.modelId)
  }

  for (const route of routes) {
    const slot = await vendorLimiter.acquire(
      route.vendorName,
      options.requestId,
      {
        rpm: route.rpm,
        burst: route.burst,
        maxConcurrency: route.maxConcurrency,
        leaseTtlMs: options.leaseTtlMs,
        probeTtlMs: route.probeTtlMs,
      },
    )
    if (!slot.ok) continue

    const mappedPayload = await mapPayload(
      route.vendorName,
      options.modelId,
      options.payload,
    )
    return {
      requestId: options.requestId,
      modelId: options.modelId,
      vendorName: route.vendorName,
      apiName: route.apiName,
      mappedPayload,
      cooldownMs: route.cooldownMs,
      probeTtlMs: route.probeTtlMs,
    }
  }

  throw new AllVendorsSaturatedError(options.modelId)
}

export async function submitWithFailover(
  options: SubmitWithFailoverOptions,
): Promise<StickyDecision> {
  const vendorLimiter = options.limiter ?? defaultLimiter
  const makeProvider = options.createProvider ?? createProvider
  const tried: string[] = []
  let lastError: unknown

  for (let attempt = 0; attempt < MAX_FAILOVER_ATTEMPTS; attempt++) {
    const decision = await resolveAndAcquire({
      ...options,
      exclude: tried,
    })
    tried.push(decision.vendorName)

    try {
      const provider = makeProvider(decision.vendorName)
      const submitted = await provider.submitRequest(
        decision.apiName,
        decision.mappedPayload,
      )
      await vendorLimiter.release(decision.vendorName, options.requestId, {
        outcome: 'submit_ok',
        cooldownMs: decision.cooldownMs,
      })
      return {
        ...decision,
        providerRequestId: submitted.requestId,
      }
    } catch (error) {
      lastError = error
      if (isFailoverError(error)) {
        await vendorLimiter.release(decision.vendorName, options.requestId, {
          outcome: 'failure',
          retryAfterMs: retryAfterMsFrom(error),
          cooldownMs: decision.cooldownMs,
        })
        continue
      }

      await vendorLimiter.release(decision.vendorName, options.requestId, {
        outcome: 'none',
        cooldownMs: decision.cooldownMs,
      })

      if (isMediaError(error) && !error.isRetriable) {
        throw error
      }
      throw new MediaValidationError(
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error : undefined,
      )
    }
  }

  if (lastError instanceof Error) {
    throw lastError
  }
  throw new AllVendorsSaturatedError(options.modelId)
}

export async function pollWithSticky(
  decision: StickyDecision,
  createProviderFn: MediaProviderFactory = createProvider,
): Promise<GetRequestDataResponse> {
  const provider = createProviderFn(decision.vendorName)
  return provider.getRequestData(decision.providerRequestId)
}
