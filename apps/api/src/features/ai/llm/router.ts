import type { TextStreamPart, ToolSet } from "ai"
import { randomUUID } from "node:crypto"
import { createLlmAdapter } from "./adapters/factory"
import { AllLlmVendorsUnavailableError, isFailoverError } from "./errors"
import { listLlmRoutes } from "./routes"
import { classifyLlmError } from "@/features/capacity/classify"
import { rateLimitRetryAfterMs } from "@/features/capacity/retry-after"
import {
  CapacityLeaseStore,
  leaseStore as defaultLeaseStore,
} from "@/features/capacity/lease-store"
import {
  CapacityBusyError,
  CapacityUnavailableError,
  NoCapacityRouteError,
  releaseCapacityLease,
  tryAcquireCapacity,
  type CapacitySelection,
} from "@/features/capacity/router"
import type { CapacityBinding } from "@/features/capacity/bindings"
import type { ReleaseOutcome } from "@/features/capacity/types"
import type {
  LlmAdapter,
  LlmCallInput,
  LlmFailoverRequest,
  LlmRoute,
  FulfilledLlmStream,
  FulfilledLlmText,
  LlmStream,
} from "./types"

/** Silence before the first streamed content part, then the next vendor is tried. */
export const LLM_STREAM_ATTEMPT_TIMEOUT_MS = 120_000

/** Whole non-streaming attempt. Stays under the 10 minute billing abort. */
export const LLM_GENERATE_ATTEMPT_TIMEOUT_MS = 240_000

const STREAM_LEASE_TTL_MS = 60_000
const CONTENT_PARTS = new Set([
  "text-delta",
  "reasoning-delta",
  "tool-input-start",
  "tool-input-delta",
  "tool-input-end",
  "tool-call",
])

export type LlmRouterOptions = {
  listRoutes?: (modelId: string) => Promise<LlmRoute[]>
  resolveAdapter?: (
    adapter: string,
    vendorName: string,
    credential: string,
  ) => LlmAdapter
  store?: CapacityLeaseStore
  streamAttemptTimeoutMs?: number
  generateAttemptTimeoutMs?: number
}

function resolveOptions(options: LlmRouterOptions = {}) {
  return {
    listRoutes: options.listRoutes ?? listLlmRoutes,
    resolveAdapter: options.resolveAdapter ?? createLlmAdapter,
    store: options.store ?? defaultLeaseStore,
    streamAttemptTimeoutMs:
      options.streamAttemptTimeoutMs ?? LLM_STREAM_ATTEMPT_TIMEOUT_MS,
    generateAttemptTimeoutMs:
      options.generateAttemptTimeoutMs ?? LLM_GENERATE_ATTEMPT_TIMEOUT_MS,
  }
}

function toBindings(routes: LlmRoute[]): CapacityBinding[] {
  return [...routes]
    .sort(
      (a, b) =>
        a.priority - b.priority || a.vendorName.localeCompare(b.vendorName),
    )
    .map((route) => ({
      providerName: route.vendorName,
      adapter: route.adapter,
      apiName: route.apiName,
      priority: route.priority,
    }))
}

function callInput(
  request: LlmFailoverRequest,
  binding: CapacityBinding,
  abortSignal: AbortSignal,
): LlmCallInput {
  return {
    apiName: binding.apiName,
    messages: request.messages,
    abortSignal,
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
        await iterator.return?.().catch(() => undefined)
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

function unavailable(
  modelId: string,
  error?: unknown,
): AllLlmVendorsUnavailableError {
  const retryAfterMs =
    error instanceof CapacityBusyError ? error.retryAfterMs : 0
  return new AllLlmVendorsUnavailableError(modelId, retryAfterMs, error)
}

async function withAttemptDeadline<T>(
  parent: AbortSignal,
  timeoutMs: number,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  if (parent.aborted) {
    throw parent.reason instanceof Error
      ? parent.reason
      : new DOMException("The operation was aborted.", "AbortError")
  }
  const controller = new AbortController()
  const onParentAbort = () => controller.abort(parent.reason)
  parent.addEventListener("abort", onParentAbort, { once: true })
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await new Promise<T>((resolve, reject) => {
      timer = setTimeout(() => {
        const error = new DOMException(
          `LLM vendor attempt timed out after ${timeoutMs}ms`,
          "TimeoutError",
        )
        controller.abort(error)
        reject(error)
      }, timeoutMs)
      run(controller.signal).then(resolve, reject)
    })
  } finally {
    clearTimeout(timer)
    parent.removeEventListener("abort", onParentAbort)
  }
}

function leaseWatcher(
  selection: CapacitySelection,
  store: CapacityLeaseStore,
  parent: AbortSignal,
) {
  const timer = setInterval(() => {
    void store
      .renew(
        selection.lease,
        STREAM_LEASE_TTL_MS,
        selection.account.limits.probeTtlMs,
      )
      .catch((error) => {
        console.error("[llm] lease renew failed", selection.account.id, error)
      })
  }, 20_000)
  let released = false
  const release = async (outcome: ReleaseOutcome) => {
    if (released) return
    released = true
    clearInterval(timer)
    parent.removeEventListener("abort", onAbort)
    const result = await releaseCapacityLease(
      selection.lease,
      outcome,
      {
        cooldownMs: selection.account.limits.cooldownMs,
        burst:
          selection.account.limits.burst ?? selection.account.limits.rpm ?? 0,
      },
      store,
    )
    if (!result.ok && result.reason === "unavailable") {
      console.error("[llm] lease release unavailable", selection.account.id)
    }
  }
  const onAbort = () => {
    void release("not_sent")
  }
  parent.addEventListener("abort", onAbort)
  return release
}

function guardStream(
  stream: LlmStream,
  release: (outcome: ReleaseOutcome) => Promise<void>,
): LlmStream {
  return {
    ...stream,
    stream: (async function* () {
      const iterator = stream.stream[Symbol.asyncIterator]()
      try {
        while (true) {
          const next = await iterator.next()
          if (next.done) break
          yield next.value
        }
        await release("completed")
      } catch (error) {
        await release("abandoned")
        throw error
      } finally {
        await iterator.return?.().catch(() => undefined)
        await release("completed")
      }
    })(),
  }
}

export async function generateTextWithFailover(
  request: LlmFailoverRequest,
  options?: LlmRouterOptions,
): Promise<FulfilledLlmText> {
  const resolved = resolveOptions(options)
  const timeoutMs = resolved.generateAttemptTimeoutMs
  const bindings = toBindings(await resolved.listRoutes(request.modelId))
  const excludeAccountIds: string[] = []
  const excludeProviders: string[] = []
  let lastError: unknown
  const holderId = randomUUID()

  while (true) {
    let acquired: Awaited<ReturnType<typeof tryAcquireCapacity>>
    try {
      acquired = await tryAcquireCapacity({
        task: `llm:${request.modelId}`,
        holderId,
        leaseTtlMs: timeoutMs + 30_000,
        bindings,
        excludeAccountIds,
        excludeProviders,
        store: resolved.store,
      })
    } catch (error) {
      throw unavailable(request.modelId, error)
    }
    if (!acquired.ok) {
      if (acquired.reason === "no_route" && lastError instanceof Error)
        throw lastError
      throw unavailable(
        request.modelId,
        acquired.reason === "saturated"
          ? new CapacityBusyError(
              `llm:${request.modelId}`,
              acquired.retryAfterMs,
            )
          : new CapacityUnavailableError(`llm:${request.modelId}`),
      )
    }
    const { selection } = acquired
    try {
      const result = await withAttemptDeadline(
        request.abortSignal,
        timeoutMs,
        (signal) =>
          resolved
            .resolveAdapter(
              selection.binding.adapter,
              selection.account.providerName,
              selection.account.credential,
            )
            .generateText(callInput(request, selection.binding, signal)),
      )
      await releaseCapacityLease(
        selection.lease,
        "completed",
        {},
        resolved.store,
      )
      return { ...result, vendorName: selection.account.providerName }
    } catch (error) {
      const action = classifyLlmError(error)
      if (action === "account_failure") {
        await releaseCapacityLease(
          selection.lease,
          "rate_limited",
          {
            retryAfterMs: rateLimitRetryAfterMs(error),
            cooldownMs: selection.account.limits.cooldownMs,
          },
          resolved.store,
        )
        excludeAccountIds.push(selection.account.id)
        lastError = error
        continue
      }
      if (action === "route_failure") {
        await releaseCapacityLease(
          selection.lease,
          "completed",
          {},
          resolved.store,
        )
        excludeProviders.push(selection.binding.providerName)
        lastError = error
        continue
      }
      await releaseCapacityLease(
        selection.lease,
        action === "abort" || action === "not_sent" ? "not_sent" : "completed",
        {
          burst:
            selection.account.limits.burst ?? selection.account.limits.rpm ?? 0,
        },
        resolved.store,
      )
      throw error
    }
  }
}

export async function streamTextWithFailover(
  request: LlmFailoverRequest,
  options?: LlmRouterOptions,
): Promise<FulfilledLlmStream> {
  const resolved = resolveOptions(options)
  const bindings = toBindings(await resolved.listRoutes(request.modelId))
  const excludeAccountIds: string[] = []
  const excludeProviders: string[] = []
  let lastError: unknown
  const holderId = randomUUID()

  while (true) {
    const acquired = await tryAcquireCapacity({
      task: `llm:${request.modelId}`,
      holderId,
      leaseTtlMs: STREAM_LEASE_TTL_MS,
      bindings,
      excludeAccountIds,
      excludeProviders,
      store: resolved.store,
    })
    if (!acquired.ok) {
      if (acquired.reason === "no_route" && lastError instanceof Error)
        throw lastError
      throw unavailable(
        request.modelId,
        acquired.reason === "saturated"
          ? new CapacityBusyError(
              `llm:${request.modelId}`,
              acquired.retryAfterMs,
            )
          : acquired.reason === "no_route"
            ? new NoCapacityRouteError(`llm:${request.modelId}`)
            : new CapacityUnavailableError(`llm:${request.modelId}`),
      )
    }
    const { selection } = acquired
    const lifetime = new AbortController()
    const onParentAbort = () => lifetime.abort(request.abortSignal.reason)
    if (request.abortSignal.aborted) onParentAbort()
    else request.abortSignal.addEventListener("abort", onParentAbort)
    const timer = setTimeout(() => {
      lifetime.abort(
        new DOMException(
          `LLM vendor attempt timed out after ${resolved.streamAttemptTimeoutMs}ms`,
          "TimeoutError",
        ),
      )
    }, resolved.streamAttemptTimeoutMs)
    let handedOff = false
    try {
      const adapter = resolved.resolveAdapter(
        selection.binding.adapter,
        selection.account.providerName,
        selection.account.credential,
      )
      const opened = await Promise.race([
        openStream(
          adapter.streamText(
            callInput(request, selection.binding, lifetime.signal),
          ),
        ),
        new Promise<never>((_, reject) => {
          if (lifetime.signal.aborted) {
            reject(
              lifetime.signal.reason instanceof Error
                ? lifetime.signal.reason
                : new DOMException("The operation was aborted.", "AbortError"),
            )
            return
          }
          lifetime.signal.addEventListener(
            "abort",
            () => {
              reject(
                lifetime.signal.reason instanceof Error
                  ? lifetime.signal.reason
                  : new DOMException(
                      "The operation was aborted.",
                      "AbortError",
                    ),
              )
            },
            { once: true },
          )
        }),
      ])
      if (!opened.ok) throw opened.error
      clearTimeout(timer)
      handedOff = true
      const release = leaseWatcher(
        selection,
        resolved.store,
        request.abortSignal,
      )
      const releaseOnce = async (outcome: ReleaseOutcome) => {
        request.abortSignal.removeEventListener("abort", onParentAbort)
        await release(outcome)
      }
      return {
        ...guardStream(opened.stream, releaseOnce),
        vendorName: selection.account.providerName,
      }
    } catch (error) {
      clearTimeout(timer)
      const action = classifyLlmError(error)
      if (action === "account_failure") {
        await releaseCapacityLease(
          selection.lease,
          "rate_limited",
          {
            retryAfterMs: rateLimitRetryAfterMs(error),
            cooldownMs: selection.account.limits.cooldownMs,
          },
          resolved.store,
        )
        excludeAccountIds.push(selection.account.id)
        lastError = error
        continue
      }
      if (action === "route_failure") {
        await releaseCapacityLease(
          selection.lease,
          "completed",
          {},
          resolved.store,
        )
        excludeProviders.push(selection.binding.providerName)
        lastError = error
        continue
      }
      await releaseCapacityLease(
        selection.lease,
        action === "abort" || action === "not_sent" ? "not_sent" : "abandoned",
        {},
        resolved.store,
      )
      throw error
    } finally {
      if (!handedOff) {
        clearTimeout(timer)
        request.abortSignal.removeEventListener("abort", onParentAbort)
      }
    }
  }
}
