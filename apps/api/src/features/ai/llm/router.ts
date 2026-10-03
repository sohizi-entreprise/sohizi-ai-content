import type { TextStreamPart, ToolSet } from "ai"
import type Redis from "ioredis"
import { redis as defaultRedis } from "@/lib/redis"
import { DEFAULT_VENDOR_CIRCUIT_CONFIG } from "@/type"
import { createLlmAdapter } from "./adapters/factory"
import {
  AllLlmVendorsUnavailableError,
  isFailoverError,
  retryAfterMsFrom,
} from "./errors"
import { listLlmRoutes } from "./routes"
import type {
  LlmAdapter,
  LlmCallInput,
  LlmFailoverRequest,
  LlmRoute,
  LlmStream,
  LlmTextResult,
} from "./types"

const ROUTE_CACHE_TTL_SEC = 30

const CONTENT_PARTS = new Set([
  "text-delta",
  "reasoning-delta",
  "tool-input-start",
  "tool-input-delta",
  "tool-input-end",
  "tool-call",
])

export type LlmRouterOptions = {
  redis?: Redis
  listRoutes?: (modelId: string) => Promise<LlmRoute[]>
  resolveAdapter?: (adapter: string, vendorName: string) => LlmAdapter
  keyPrefix?: string
  random?: () => number
}

function cooldownKey(prefix: string, vendorName: string, modelId: string) {
  return `${prefix}llm:cd:${vendorName}:${modelId}`
}

function routesKey(prefix: string, modelId: string) {
  return `${prefix}llm:routes:${modelId}`
}

function jitteredTtl(baseMs: number, random: () => number): number {
  const factor = 0.8 + random() * 0.4
  return Math.max(1, Math.round(baseMs * factor))
}

function compareRoutes(a: LlmRoute, b: LlmRoute): number {
  return a.priority - b.priority || a.vendorName.localeCompare(b.vendorName)
}

async function loadRoutes(
  modelId: string,
  redis: Redis,
  prefix: string,
  listRoutes: (modelId: string) => Promise<LlmRoute[]>,
): Promise<LlmRoute[]> {
  const key = routesKey(prefix, modelId)
  try {
    const cached = await redis.get(key)
    if (cached) {
      const parsed = JSON.parse(cached) as LlmRoute[]
      if (Array.isArray(parsed)) return parsed
    }
  } catch (error) {
    console.error("[llm] route cache read failed", modelId, error)
  }

  const routes = await listRoutes(modelId)
  try {
    await redis.set(key, JSON.stringify(routes), "EX", ROUTE_CACHE_TTL_SEC)
  } catch (error) {
    console.error("[llm] route cache write failed", modelId, error)
  }
  return routes
}

async function soonestTtl(redis: Redis, keys: string[]): Promise<number> {
  if (keys.length === 0) return 0
  try {
    const pipeline = redis.pipeline()
    for (const key of keys) pipeline.pttl(key)
    const rows = await pipeline.exec()
    let soonest = Number.POSITIVE_INFINITY
    for (const row of rows ?? []) {
      const ttl = Number(row?.[1])
      if (ttl > 0 && ttl < soonest) soonest = ttl
    }
    return Number.isFinite(soonest) ? soonest : 0
  } catch (error) {
    console.error("[llm] cooldown ttl read failed", error)
    return 0
  }
}

async function markCooldown(
  redis: Redis,
  key: string,
  ttlMs: number,
): Promise<void> {
  try {
    await redis.set(key, "1", "PX", ttlMs)
  } catch (error) {
    console.error("[llm] cooldown write failed", key, error)
  }
}

type Candidates = {
  routes: LlmRoute[]
  soonestCooldownMs: number
}

async function selectCandidates(
  modelId: string,
  options: Required<
    Pick<LlmRouterOptions, "redis" | "listRoutes" | "keyPrefix">
  >,
): Promise<Candidates> {
  const loaded = await loadRoutes(
    modelId,
    options.redis,
    options.keyPrefix,
    options.listRoutes,
  )
  const routes = [...loaded].sort(compareRoutes)
  if (routes.length === 0) {
    throw new AllLlmVendorsUnavailableError(modelId, 0)
  }

  const keys = routes.map((route) =>
    cooldownKey(options.keyPrefix, route.vendorName, modelId),
  )
  try {
    const cooling = await options.redis.mget(...keys)
    const open: LlmRoute[] = []
    const coolingKeys: string[] = []
    for (let index = 0; index < routes.length; index++) {
      const route = routes[index]
      if (!route) continue
      if (cooling[index]) {
        coolingKeys.push(keys[index] ?? "")
      } else {
        open.push(route)
      }
    }
    if (open.length === 0) {
      return {
        routes: [],
        soonestCooldownMs: await soonestTtl(options.redis, coolingKeys),
      }
    }
    return { routes: open, soonestCooldownMs: 0 }
  } catch (error) {
    console.error("[llm] cooldown read failed", modelId, error)
    return { routes, soonestCooldownMs: 0 }
  }
}

function callInput(request: LlmFailoverRequest, route: LlmRoute): LlmCallInput {
  return {
    apiName: route.apiName,
    messages: request.messages,
    abortSignal: request.abortSignal,
    tools: request.tools,
    outputSchema: request.outputSchema,
    maxOutputTokens: request.maxOutputTokens,
    reasoningEffort: request.reasoningEffort,
    reasoningSummary: request.reasoningSummary,
    telemetryFunctionId: request.telemetryFunctionId,
  }
}

function isContentPart(part: TextStreamPart<ToolSet>): boolean {
  return CONTENT_PARTS.has(part.type)
}

async function* concatStream(
  buffered: TextStreamPart<ToolSet>[],
  iterator: AsyncIterator<TextStreamPart<ToolSet>>,
): AsyncGenerator<TextStreamPart<ToolSet>> {
  for (const part of buffered) yield part
  while (true) {
    const next = await iterator.next()
    if (next.done) return
    yield next.value
  }
}

async function openStream(
  handle: LlmStream,
): Promise<{ ok: true; stream: LlmStream } | { ok: false; error: unknown }> {
  const iterator = handle.stream[Symbol.asyncIterator]()
  const buffered: TextStreamPart<ToolSet>[] = []
  try {
    while (true) {
      const next = await iterator.next()
      if (next.done) break
      const part = next.value
      if (part.type === "error" && isFailoverError(part.error)) {
        await iterator.return?.()
        return { ok: false, error: part.error }
      }
      buffered.push(part)
      if (isContentPart(part) || part.type === "error") break
    }
  } catch (error) {
    await iterator.return?.().catch(() => undefined)
    if (isFailoverError(error)) return { ok: false, error }
    throw error
  }

  return {
    ok: true,
    stream: {
      stream: concatStream(buffered, iterator),
      usage: handle.usage,
      finishReason: handle.finishReason,
      costUsd: handle.costUsd,
    },
  }
}

function resolveOptions(options: LlmRouterOptions = {}) {
  return {
    redis: options.redis ?? defaultRedis,
    listRoutes: options.listRoutes ?? listLlmRoutes,
    resolveAdapter: options.resolveAdapter ?? createLlmAdapter,
    keyPrefix: options.keyPrefix ?? "",
    random: options.random ?? Math.random,
  }
}

async function failover<T>(
  request: LlmFailoverRequest,
  options: LlmRouterOptions,
  run: (adapter: LlmAdapter, route: LlmRoute) => Promise<T>,
): Promise<T> {
  const resolved = resolveOptions(options)
  const selected = await selectCandidates(request.modelId, resolved)
  if (selected.routes.length === 0) {
    throw new AllLlmVendorsUnavailableError(
      request.modelId,
      selected.soonestCooldownMs,
    )
  }

  let lastError: unknown
  let soonest = Number.POSITIVE_INFINITY
  for (const route of selected.routes) {
    try {
      const adapter = resolved.resolveAdapter(route.adapter, route.vendorName)
      return await run(adapter, route)
    } catch (error) {
      if (!isFailoverError(error)) throw error
      const base = Math.max(
        retryAfterMsFrom(error),
        route.cooldownMs || DEFAULT_VENDOR_CIRCUIT_CONFIG.cooldownMs,
      )
      const ttl = jitteredTtl(base, resolved.random)
      soonest = Math.min(soonest, ttl)
      console.warn("[llm] failover", {
        modelId: request.modelId,
        vendor: route.vendorName,
        adapter: route.adapter,
        ttlMs: ttl,
      })
      await markCooldown(
        resolved.redis,
        cooldownKey(resolved.keyPrefix, route.vendorName, request.modelId),
        ttl,
      )
      lastError = error
    }
  }

  throw new AllLlmVendorsUnavailableError(
    request.modelId,
    Number.isFinite(soonest) ? soonest : 0,
    lastError,
  )
}

export function generateTextWithFailover(
  request: LlmFailoverRequest,
  options?: LlmRouterOptions,
): Promise<LlmTextResult> {
  return failover(request, options ?? {}, async (adapter, route) =>
    adapter.generateText(callInput(request, route)),
  )
}

export async function streamTextWithFailover(
  request: LlmFailoverRequest,
  options?: LlmRouterOptions,
): Promise<LlmStream> {
  const resolved = resolveOptions(options)
  const selected = await selectCandidates(request.modelId, resolved)
  if (selected.routes.length === 0) {
    throw new AllLlmVendorsUnavailableError(
      request.modelId,
      selected.soonestCooldownMs,
    )
  }

  let lastError: unknown
  let soonest = Number.POSITIVE_INFINITY
  for (const route of selected.routes) {
    let handle: LlmStream
    try {
      const adapter = resolved.resolveAdapter(route.adapter, route.vendorName)
      handle = adapter.streamText(callInput(request, route))
    } catch (error) {
      if (!isFailoverError(error)) throw error
      lastError = error
      soonest = await cool(resolved, request.modelId, route, error, soonest)
      continue
    }

    const opened = await openStream(handle)
    if (opened.ok) return opened.stream
    lastError = opened.error
    soonest = await cool(
      resolved,
      request.modelId,
      route,
      opened.error,
      soonest,
    )
  }

  throw new AllLlmVendorsUnavailableError(
    request.modelId,
    Number.isFinite(soonest) ? soonest : 0,
    lastError,
  )
}

async function cool(
  resolved: ReturnType<typeof resolveOptions>,
  modelId: string,
  route: LlmRoute,
  error: unknown,
  soonest: number,
): Promise<number> {
  const base = Math.max(
    retryAfterMsFrom(error),
    route.cooldownMs || DEFAULT_VENDOR_CIRCUIT_CONFIG.cooldownMs,
  )
  const ttl = jitteredTtl(base, resolved.random)
  console.warn("[llm] failover", {
    modelId,
    vendor: route.vendorName,
    adapter: route.adapter,
    ttlMs: ttl,
  })
  await markCooldown(
    resolved.redis,
    cooldownKey(resolved.keyPrefix, route.vendorName, modelId),
    ttl,
  )
  return Math.min(soonest, ttl)
}
