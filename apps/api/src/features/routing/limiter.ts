import { readFileSync } from "node:fs"
import { join } from "node:path"
import type Redis from "ioredis"
import { redis as defaultRedis } from "@/lib/redis"
import {
  DEFAULT_VENDOR_CIRCUIT_CONFIG,
  DEFAULT_VENDOR_RATE_LIMIT,
} from "@/type"
import type { AcquireResult, ReleaseOutcome } from "./types"

const ACQUIRE_LUA = readFileSync(
  join(import.meta.dir, "lua/acquire.lua"),
  "utf8",
)
const RELEASE_LUA = readFileSync(
  join(import.meta.dir, "lua/release.lua"),
  "utf8",
)

const INFLIGHT_KEY_TTL_MS = 24 * 60 * 60 * 1000
const DEFAULT_ACQUIRE_TIMEOUT_MS = 100

export type LimiterAcquireLimits = {
  rpm: number
  burst: number
  maxConcurrency: number
  leaseTtlMs: number
  probeTtlMs?: number
}

export type LimiterReleaseOptions = {
  outcome: ReleaseOutcome
  retryAfterMs?: number
  cooldownMs?: number
}

export type LimiterOptions = {
  redis?: Redis
  keyPrefix?: string
  acquireTimeoutMs?: number
}

export type VendorLimiterKeys = {
  inflight: string
  tb: string
  cb: string
}

function parseEvalTuple(raw: unknown): AcquireResult {
  const row = raw as Array<string | number>
  const ok = Number(row[0]) === 1
  const reason = String(row[1] ?? "unavailable")
  const retryAfterMs = Math.max(Number(row[2] ?? 0), 0)
  if (ok) {
    return { ok: true, reason: "ok", retryAfterMs: 0 }
  }
  if (
    reason === "circuit_open" ||
    reason === "concurrency" ||
    reason === "rpm"
  ) {
    return { ok: false, reason, retryAfterMs }
  }
  return { ok: false, reason: "unavailable", retryAfterMs }
}

export class VendorLimiter {
  private readonly redis: Redis
  private readonly keyPrefix: string
  private readonly acquireTimeoutMs: number

  constructor(options: LimiterOptions = {}) {
    this.redis = options.redis ?? defaultRedis
    this.keyPrefix = options.keyPrefix ?? ""
    this.acquireTimeoutMs =
      options.acquireTimeoutMs ?? DEFAULT_ACQUIRE_TIMEOUT_MS
  }

  keys(vendorName: string): VendorLimiterKeys {
    return {
      inflight: `${this.keyPrefix}inflight:${vendorName}`,
      tb: `${this.keyPrefix}tb:${vendorName}`,
      cb: `${this.keyPrefix}cb:${vendorName}`,
    }
  }

  ownerKey(requestId: string): string {
    return `${this.keyPrefix}owner:${requestId}`
  }

  async acquire(
    vendorName: string,
    requestId: string,
    limits: LimiterAcquireLimits,
  ): Promise<AcquireResult> {
    const keys = this.keys(vendorName)
    const burst = limits.burst > 0 ? limits.burst : limits.rpm
    const probeTtlMs =
      limits.probeTtlMs ?? DEFAULT_VENDOR_CIRCUIT_CONFIG.probeTtlMs

    try {
      const evalPromise = this.redis.eval(
        ACQUIRE_LUA,
        3,
        keys.inflight,
        keys.tb,
        keys.cb,
        requestId,
        String(limits.maxConcurrency),
        String(limits.rpm),
        String(burst),
        String(limits.leaseTtlMs),
        String(probeTtlMs),
        String(INFLIGHT_KEY_TTL_MS),
      )
      const timeout = new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), this.acquireTimeoutMs)
      })
      const raw = await Promise.race([evalPromise, timeout])
      if (raw === null) {
        return { ok: false, reason: "unavailable", retryAfterMs: 0 }
      }
      const parsed = parseEvalTuple(raw)
      if (parsed.ok) {
        await this.redis.set(
          this.ownerKey(requestId),
          vendorName,
          "PX",
          limits.leaseTtlMs,
        )
      }
      return parsed
    } catch (error) {
      console.error("[routing] acquire failed", vendorName, error)
      return { ok: false, reason: "unavailable", retryAfterMs: 0 }
    }
  }

  async release(
    vendorName: string,
    requestId: string,
    options: LimiterReleaseOptions,
  ): Promise<void> {
    const keys = this.keys(vendorName)
    const retryAfterMs = options.retryAfterMs ?? 0
    const cooldownMs =
      options.cooldownMs ?? DEFAULT_VENDOR_CIRCUIT_CONFIG.cooldownMs
    try {
      await this.redis.eval(
        RELEASE_LUA,
        2,
        keys.inflight,
        keys.cb,
        requestId,
        options.outcome,
        String(retryAfterMs),
        String(cooldownMs),
      )
      if (options.outcome !== "submit_ok") {
        await this.redis.del(this.ownerKey(requestId))
      }
    } catch (error) {
      console.error("[routing] release failed", vendorName, requestId, error)
    }
  }

  async releaseByRequestId(
    requestId: string,
    options: LimiterReleaseOptions,
  ): Promise<void> {
    const vendorName = await this.redis.get(this.ownerKey(requestId))
    if (!vendorName) return
    await this.release(vendorName, requestId, options)
  }

  async inflightCount(vendorName: string): Promise<number> {
    return this.redis.zcard(this.keys(vendorName).inflight)
  }

  async tokenBucket(
    vendorName: string,
  ): Promise<{ tokens: number | null; ts: number | null }> {
    const [tokens, ts] = await this.redis.hmget(
      this.keys(vendorName).tb,
      "tokens",
      "ts",
    )
    return {
      tokens: tokens == null ? null : Number(tokens),
      ts: ts == null ? null : Number(ts),
    }
  }

  async circuitState(vendorName: string): Promise<Record<string, string>> {
    return this.redis.hgetall(this.keys(vendorName).cb)
  }

  async deleteKeys(vendorName: string): Promise<void> {
    const keys = this.keys(vendorName)
    await this.redis.del(keys.inflight, keys.tb, keys.cb)
  }

  async deleteOwner(requestId: string): Promise<void> {
    await this.redis.del(this.ownerKey(requestId))
  }
}

export const limiter = new VendorLimiter()

export { DEFAULT_VENDOR_RATE_LIMIT }
