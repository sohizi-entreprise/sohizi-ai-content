import { randomUUID } from "node:crypto"
import {
  CapacityLeaseStore,
  clampRetryAfter,
  leaseStore as defaultLeaseStore,
  MAX_RETRY_AFTER_MS,
  MIN_RETRY_AFTER_MS,
} from "./lease-store"
import {
  listLlmBindings,
  listMediaBindings,
  type CapacityBinding,
} from "./bindings"
import {
  accountPoolId,
  listProvidersForTask,
  resolveProviderAccounts,
  type ResolvedAccount,
} from "./registry"
import type {
  CapacityTask,
  ErrorAction,
  LeaseHandle,
  ReleaseOutcome,
} from "./types"
import { rateLimitRetryAfterMs } from "./retry-after"

export class NoCapacityRouteError extends Error {
  readonly code = "NO_ROUTE"

  constructor(task: string) {
    super(`No enabled capacity route for ${task}`)
    this.name = "NoCapacityRouteError"
  }
}

export class CapacityBusyError extends Error {
  readonly code = "CAPACITY_BUSY"

  constructor(
    task: string,
    readonly retryAfterMs: number,
  ) {
    super(`Capacity is busy for ${task}. Retry after ${retryAfterMs}ms.`)
    this.name = "CapacityBusyError"
  }
}

export class CapacityUnavailableError extends Error {
  readonly code = "CAPACITY_UNAVAILABLE"

  constructor(task: string) {
    super(`Capacity ledger is unavailable for ${task}`)
    this.name = "CapacityUnavailableError"
  }
}

export type CapacitySelection = {
  account: ResolvedAccount
  binding: CapacityBinding
  lease: LeaseHandle
}

export type TryAcquireResult =
  | { ok: true; selection: CapacitySelection }
  | { ok: false; reason: "saturated" | "unavailable"; retryAfterMs: number }
  | { ok: false; reason: "no_route" }

export type TryAcquireInput = {
  task: string
  holderId: string
  leaseTtlMs: number
  bindings?: CapacityBinding[]
  excludeAccountIds?: string[]
  excludeProviders?: string[]
  store?: CapacityLeaseStore
}

const STATIC_TASKS = new Set<CapacityTask>([
  "web.search",
  "web.extract",
  "video.export",
])

function abortError(signal: AbortSignal): Error {
  return signal.reason instanceof Error
    ? signal.reason
    : new DOMException("The operation was aborted.", "AbortError")
}

export async function abortableSleep(
  ms: number,
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted) throw abortError(signal)
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(abortError(signal!))
    }
    signal?.addEventListener("abort", onAbort, { once: true })
  })
}

function jitter(ms: number, random = Math.random): number {
  return clampRetryAfter(ms * (0.8 + random() * 0.4))
}

async function bindingsFor(
  task: string,
  injected?: CapacityBinding[],
): Promise<CapacityBinding[]> {
  if (injected) {
    return [...injected].sort(
      (a, b) =>
        a.priority - b.priority || a.providerName.localeCompare(b.providerName),
    )
  }
  if (task.startsWith("llm:")) return listLlmBindings(task.slice(4))
  if (task.startsWith("media:")) return listMediaBindings(task.slice(6))
  if (!STATIC_TASKS.has(task as CapacityTask)) return []
  return listProvidersForTask(task as CapacityTask).map((provider) => ({
    providerName: provider.name,
    adapter: provider.adapter,
    apiName: task,
    priority: 0,
  }))
}

async function orderedAccounts(
  binding: CapacityBinding,
  store: CapacityLeaseStore,
): Promise<ResolvedAccount[]> {
  const accounts = resolveProviderAccounts(binding.providerName).filter(
    (account) => account.adapter === binding.adapter,
  )
  if (accounts[0]?.strategy !== "spread") return accounts
  const scored = await Promise.all(
    accounts.map(async (account) => {
      try {
        const inflight = await store.inflightCount(accountPoolId(account.id))
        return { account, free: account.limits.maxConcurrency - inflight }
      } catch (error) {
        console.error("[capacity] spread snapshot failed", account.id, error)
        return { account, free: 0 }
      }
    }),
  )
  return scored
    .sort((a, b) => b.free - a.free || a.account.id.localeCompare(b.account.id))
    .map((entry) => entry.account)
}

export async function tryAcquireCapacity(
  input: TryAcquireInput,
): Promise<TryAcquireResult> {
  const store = input.store ?? defaultLeaseStore
  const excludedAccounts = new Set(input.excludeAccountIds ?? [])
  const excludedProviders = new Set(input.excludeProviders ?? [])
  const bindings = await bindingsFor(input.task, input.bindings)
  let sawAccount = false
  let smallestRetry = MAX_RETRY_AFTER_MS
  let sawCapacityReject = false
  let sawUnavailable = false

  for (const binding of bindings) {
    if (excludedProviders.has(binding.providerName)) continue
    const accounts = await orderedAccounts(binding, store)
    for (const account of accounts) {
      if (excludedAccounts.has(account.id)) continue
      sawAccount = true
      const acquired = await store.acquire(
        accountPoolId(account.id),
        input.holderId,
        {
          rpm: account.limits.rpm,
          burst: account.limits.burst,
          maxConcurrency: account.limits.maxConcurrency,
          leaseTtlMs: input.leaseTtlMs,
          probeTtlMs: account.limits.probeTtlMs,
          cooldownMs: account.limits.cooldownMs,
        },
      )
      if (acquired.ok) {
        return {
          ok: true,
          selection: { account, binding, lease: acquired.lease },
        }
      }
      if (acquired.reason === "unavailable") {
        sawUnavailable = true
      } else {
        sawCapacityReject = true
        smallestRetry = Math.min(smallestRetry, acquired.retryAfterMs)
      }
    }
  }

  if (!sawAccount) return { ok: false, reason: "no_route" }
  if (!sawCapacityReject && sawUnavailable) {
    return {
      ok: false,
      reason: "unavailable",
      retryAfterMs: MIN_RETRY_AFTER_MS,
    }
  }
  return {
    ok: false,
    reason: "saturated",
    retryAfterMs: smallestRetry,
  }
}

function retryAfterFrom(error: unknown): number | undefined {
  return rateLimitRetryAfterMs(error)
}

async function finishRelease(
  store: CapacityLeaseStore,
  selection: CapacitySelection,
  outcome: ReleaseOutcome,
  error?: unknown,
): Promise<void> {
  const released = await store.release(selection.lease, outcome, {
    retryAfterMs:
      outcome === "rate_limited" ? retryAfterFrom(error) : undefined,
    cooldownMs: selection.account.limits.cooldownMs,
    burst: selection.account.limits.burst ?? selection.account.limits.rpm ?? 0,
  })
  if (!released.ok && released.reason === "unavailable") {
    throw new CapacityUnavailableError(selection.account.id)
  }
}

export async function runWithCapacity<T>(input: {
  task: string
  holderId?: string
  leaseTtlMs: number
  waitMs?: number
  signal?: AbortSignal
  bindings?: CapacityBinding[]
  classify: (error: unknown) => ErrorAction
  store?: CapacityLeaseStore
  random?: () => number
  run: (selection: CapacitySelection) => Promise<T>
}): Promise<T> {
  const store = input.store ?? defaultLeaseStore
  const holderId = input.holderId ?? randomUUID()
  const deadline = Date.now() + Math.max(input.waitMs ?? 0, 0)
  const excludeAccountIds: string[] = []
  const excludeProviders: string[] = []
  let lastError: unknown

  while (true) {
    if (input.signal?.aborted) throw abortError(input.signal)
    const acquired = await tryAcquireCapacity({
      task: input.task,
      holderId,
      leaseTtlMs: input.leaseTtlMs,
      bindings: input.bindings,
      excludeAccountIds,
      excludeProviders,
      store,
    })
    if (acquired.ok) {
      try {
        const value = await input.run(acquired.selection)
        await finishRelease(store, acquired.selection, "completed")
        return value
      } catch (error) {
        const action = input.classify(error)
        if (action === "submission_unknown") throw error
        if (action === "account_failure") {
          await finishRelease(store, acquired.selection, "rate_limited", error)
          excludeAccountIds.push(acquired.selection.account.id)
          lastError = error
          continue
        }
        if (action === "route_failure") {
          await finishRelease(store, acquired.selection, "completed", error)
          excludeProviders.push(acquired.selection.binding.providerName)
          lastError = error
          continue
        }
        if (action === "not_sent") {
          await finishRelease(store, acquired.selection, "not_sent", error)
          lastError = error
          continue
        }
        await finishRelease(
          store,
          acquired.selection,
          action === "abort" ? "not_sent" : "completed",
          error,
        )
        throw error
      }
    }

    if (acquired.reason === "no_route") {
      if (lastError instanceof Error) throw lastError
      throw new NoCapacityRouteError(input.task)
    }
    if (Date.now() >= deadline) {
      if (acquired.reason === "unavailable") {
        throw new CapacityUnavailableError(input.task)
      }
      throw new CapacityBusyError(input.task, acquired.retryAfterMs)
    }
    const remaining = deadline - Date.now()
    await abortableSleep(
      Math.min(jitter(acquired.retryAfterMs, input.random), remaining),
      input.signal,
    )
  }
}

export async function renewCapacityLease(
  lease: LeaseHandle,
  leaseTtlMs: number,
  probeTtlMs?: number,
  store: CapacityLeaseStore = defaultLeaseStore,
) {
  return store.renew(lease, leaseTtlMs, probeTtlMs)
}

export async function releaseCapacityLease(
  lease: LeaseHandle,
  outcome: ReleaseOutcome,
  options: { retryAfterMs?: number; cooldownMs?: number; burst?: number } = {},
  store: CapacityLeaseStore = defaultLeaseStore,
) {
  const result = await store.release(lease, outcome, options)
  if (!result.ok && result.reason === "not_found") return { ok: true as const }
  return result
}
