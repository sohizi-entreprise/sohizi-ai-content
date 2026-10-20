import { randomUUID } from "node:crypto"
import type Redis from "ioredis"
import { capacityRedis } from "./redis"
import type {
  AcquireResult,
  LeaseHandle,
  LeaseLimits,
  LeaseMutationResult,
  ReleaseOutcome,
} from "./types"
import ACQUIRE_LUA from "./lua/acquire.lua" with { type: "text" }
import RENEW_LUA from "./lua/renew.lua" with { type: "text" }
import RELEASE_LUA from "./lua/release.lua" with { type: "text" }

const INFLIGHT_KEY_TTL_MS = 24 * 60 * 60 * 1000
const DEFAULT_PROBE_TTL_MS = 30_000
const DEFAULT_COOLDOWN_MS = 15_000
export const MIN_RETRY_AFTER_MS = 250
export const MAX_RETRY_AFTER_MS = 15_000

export type LeaseStoreOptions = {
  redis?: Redis
  keyPrefix?: string
}

function asRow(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((value) => String(value))
}

export function clampRetryAfter(ms: number): number {
  if (!Number.isFinite(ms) || ms <= 0) return MIN_RETRY_AFTER_MS
  return Math.min(
    Math.max(Math.ceil(ms), MIN_RETRY_AFTER_MS),
    MAX_RETRY_AFTER_MS,
  )
}

function assertId(value: string, label: string): void {
  if (!value || /[\s]/.test(value)) {
    throw new Error(`Invalid capacity ${label}`)
  }
}

export class CapacityLeaseStore {
  private readonly redis: Redis
  private readonly keyPrefix: string

  constructor(options: LeaseStoreOptions = {}) {
    this.redis = options.redis ?? capacityRedis
    this.keyPrefix = options.keyPrefix ?? "cap:"
  }

  keys(poolId: string, holderId?: string) {
    const base = `${this.keyPrefix}${poolId}`
    return {
      inflight: `${base}:inflight`,
      tb: `${base}:tb`,
      cb: `${base}:cb`,
      holder: holderId ? `${base}:holder:${holderId}` : "",
      epoch: holderId ? `${base}:epoch:${holderId}` : "",
    }
  }

  async acquire(
    poolId: string,
    holderId: string,
    limits: LeaseLimits,
  ): Promise<AcquireResult> {
    assertId(poolId, "pool id")
    assertId(holderId, "holder id")
    const proposedLeaseId = randomUUID()
    try {
      return await this.evalAcquire(poolId, holderId, proposedLeaseId, limits)
    } catch (error) {
      console.error("[capacity] acquire failed", poolId, error)
      return {
        ok: false,
        reason: "unavailable",
        retryAfterMs: MIN_RETRY_AFTER_MS,
      }
    }
  }

  async renew(
    lease: LeaseHandle,
    leaseTtlMs: number,
    probeTtlMs = DEFAULT_PROBE_TTL_MS,
  ): Promise<LeaseMutationResult> {
    const keys = this.keys(lease.poolId, lease.holderId)
    try {
      const raw = await this.redis.eval(
        RENEW_LUA,
        3,
        keys.inflight,
        keys.holder,
        keys.cb,
        lease.leaseId,
        String(lease.epoch),
        String(leaseTtlMs),
        String(probeTtlMs),
        String(INFLIGHT_KEY_TTL_MS),
      )
      const row = asRow(raw)
      if (row[0] === "1") {
        return { ok: true, expiresAtMs: Number(row[2]) }
      }
      const reason = row[1]
      if (reason === "stale_lease" || reason === "not_found") {
        return { ok: false, reason }
      }
      return { ok: false, reason: "unavailable" }
    } catch (error) {
      console.error("[capacity] renew failed", lease.poolId, error)
      return { ok: false, reason: "unavailable" }
    }
  }

  async release(
    lease: LeaseHandle,
    outcome: ReleaseOutcome,
    options: {
      retryAfterMs?: number
      cooldownMs?: number
      burst?: number
    } = {},
  ): Promise<LeaseMutationResult> {
    const keys = this.keys(lease.poolId, lease.holderId)
    try {
      const raw = await this.redis.eval(
        RELEASE_LUA,
        4,
        keys.inflight,
        keys.holder,
        keys.tb,
        keys.cb,
        lease.leaseId,
        String(lease.epoch),
        outcome,
        String(options.retryAfterMs ?? 0),
        String(options.cooldownMs ?? DEFAULT_COOLDOWN_MS),
        String(options.burst ?? 0),
      )
      const row = asRow(raw)
      if (row[0] === "1") return { ok: true }
      if (row[1] === "stale_lease" || row[1] === "not_found") {
        return { ok: false, reason: row[1] }
      }
      return { ok: false, reason: "unavailable" }
    } catch (error) {
      console.error("[capacity] release failed", lease.poolId, error)
      return { ok: false, reason: "unavailable" }
    }
  }

  async inflightCount(poolId: string): Promise<number> {
    return this.redis.zcard(this.keys(poolId).inflight)
  }

  async tokenBucket(
    poolId: string,
  ): Promise<{ tokens: number | null; ts: number | null }> {
    const [tokens, ts] = await this.redis.hmget(
      this.keys(poolId).tb,
      "tokens",
      "ts",
    )
    return {
      tokens: tokens == null ? null : Number(tokens),
      ts: ts == null ? null : Number(ts),
    }
  }

  async circuitState(poolId: string): Promise<Record<string, string>> {
    return this.redis.hgetall(this.keys(poolId).cb)
  }

  async deletePool(poolId: string, holderIds: string[] = []): Promise<void> {
    const keys = this.keys(poolId)
    const extra = holderIds.flatMap((holderId) => {
      const holderKeys = this.keys(poolId, holderId)
      return [holderKeys.holder, holderKeys.epoch]
    })
    await this.redis.del(keys.inflight, keys.tb, keys.cb, ...extra)
  }

  private async evalAcquire(
    poolId: string,
    holderId: string,
    leaseId: string,
    limits: LeaseLimits,
  ): Promise<AcquireResult> {
    const keys = this.keys(poolId, holderId)
    const rpm = limits.rpm ?? 0
    const burst = limits.burst ?? 0
    const raw = await this.redis.eval(
      ACQUIRE_LUA,
      5,
      keys.inflight,
      keys.holder,
      keys.tb,
      keys.cb,
      keys.epoch,
      leaseId,
      String(limits.maxConcurrency),
      String(rpm),
      String(burst),
      String(limits.leaseTtlMs),
      String(limits.probeTtlMs ?? DEFAULT_PROBE_TTL_MS),
      String(INFLIGHT_KEY_TTL_MS),
    )
    const row = asRow(raw)
    if (row[0] === "1") {
      return {
        ok: true,
        replay: row[5] === "1",
        lease: {
          poolId,
          holderId,
          leaseId: row[2] ?? leaseId,
          epoch: Number(row[3]),
          expiresAtMs: Number(row[4]),
        },
      }
    }
    const reason = row[1]
    const retryAfterMs = clampRetryAfter(Number(row[6] ?? 0))
    if (
      reason === "circuit_open" ||
      reason === "concurrency" ||
      reason === "rpm"
    ) {
      return { ok: false, reason, retryAfterMs }
    }
    return { ok: false, reason: "unavailable", retryAfterMs }
  }
}

export const leaseStore = new CapacityLeaseStore()
