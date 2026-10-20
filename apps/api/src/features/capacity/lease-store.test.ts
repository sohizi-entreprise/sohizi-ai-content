import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { redis } from "@/lib/redis"
import { CapacityLeaseStore } from "./lease-store"
import type { LeaseHandle } from "./types"

const pool = "pool-a"
let store: CapacityLeaseStore
let prefix: string

const limits = {
  rpm: 60,
  burst: 60,
  maxConcurrency: 2,
  leaseTtlMs: 60_000,
  probeTtlMs: 30_000,
  cooldownMs: 15_000,
}

beforeEach(() => {
  prefix = `test:${randomUUID()}:`
  store = new CapacityLeaseStore({ redis, keyPrefix: prefix })
})

afterEach(async () => {
  const keys = await redis.keys(`${prefix}*`)
  if (keys.length > 0) await redis.del(...keys)
})

async function acquire(holder: string, overrides: Partial<typeof limits> = {}) {
  const result = await store.acquire(pool, holder, { ...limits, ...overrides })
  if (!result.ok) throw new Error(`expected acquire: ${result.reason}`)
  return result.lease
}

describe("CapacityLeaseStore", () => {
  test("caps inflight at maxConcurrency", async () => {
    await acquire("r1")
    await acquire("r2")
    const third = await store.acquire(pool, "r3", limits)
    expect(third.ok).toBe(false)
    if (!third.ok) expect(third.reason).toBe("concurrency")
    expect(await store.inflightCount(pool)).toBe(2)
  })

  test("same holder replay does not spend another token", async () => {
    const first = await acquire("same", { rpm: 5, burst: 5 })
    const before = await store.tokenBucket(pool)
    const second = await store.acquire(pool, "same", {
      ...limits,
      rpm: 5,
      burst: 5,
    })
    expect(second.ok).toBe(true)
    if (second.ok) {
      expect(second.replay).toBe(true)
      expect(second.lease.leaseId).toBe(first.leaseId)
      expect(second.lease.epoch).toBe(first.epoch)
    }
    const after = await store.tokenBucket(pool)
    expect(after.tokens).toBe(before.tokens)
    expect(await store.inflightCount(pool)).toBe(1)
  })

  test("the same holder in another pool is an independent lease", async () => {
    await acquire("shared")
    const other = await store.acquire("pool-b", "shared", limits)
    expect(other.ok).toBe(true)
    expect(await store.inflightCount(pool)).toBe(1)
    expect(await store.inflightCount("pool-b")).toBe(1)
  })

  test("concurrency-only acquire does not starve when burst is zero", async () => {
    const first = await store.acquire(pool, "c1", {
      maxConcurrency: 1,
      leaseTtlMs: 60_000,
      rpm: 0,
      burst: 0,
    })
    const second = await store.acquire(pool, "c2", {
      maxConcurrency: 1,
      leaseTtlMs: 60_000,
      rpm: 0,
      burst: 0,
    })
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(false)
    if (!second.ok) expect(second.reason).toBe("concurrency")
    expect(await store.tokenBucket(pool)).toEqual({ tokens: null, ts: null })
  })

  test("not_sent refunds one token and completed or rate_limited does not", async () => {
    const tight = { ...limits, rpm: 60, burst: 3, maxConcurrency: 10 }
    const refunded = await acquire("refund", tight)
    const kept = await acquire("kept", tight)
    const limited = await acquire("limited", tight)
    await store.release(refunded, "not_sent", { burst: 3 })
    await store.release(kept, "completed", { burst: 3 })
    await store.release(limited, "rate_limited", {
      burst: 3,
      cooldownMs: 5_000,
    })
    const bucket = await store.tokenBucket(pool)
    expect(bucket.tokens ?? 0).toBeGreaterThan(0.9)
    expect(bucket.tokens ?? 0).toBeLessThan(1.2)
  })

  test("a stale release does not free the replacement lease", async () => {
    const first = await acquire("holder", { leaseTtlMs: 30_000 })
    await redis.zadd(store.keys(pool).inflight, 1, first.leaseId)
    await redis.del(store.keys(pool, "holder").holder)
    const second = await acquire("holder")
    expect(second.epoch).toBe(first.epoch + 1)
    const stale = await store.release(first, "completed", {
      burst: limits.burst,
    })
    expect(stale).toEqual({ ok: false, reason: "stale_lease" })
    expect(await store.inflightCount(pool)).toBe(1)
    const current = await store.release(second, "completed")
    expect(current.ok).toBe(true)
    expect(await store.inflightCount(pool)).toBe(0)
  })

  test("a provider retry-after is used even when it differs from cooldown", async () => {
    const lease = await acquire("provider-delay")
    const before = Date.now()
    await store.release(lease, "rate_limited", {
      retryAfterMs: 4_000,
      cooldownMs: 15_000,
    })
    const until = Number((await store.circuitState(pool)).open_until)
    expect(until).toBeGreaterThan(before + 3_500)
    expect(until).toBeLessThan(before + 4_500)
  })

  test("a missing retry-after uses the registry cooldown", async () => {
    const lease = await acquire("cooldown")
    const before = Date.now()
    await store.release(lease, "rate_limited", { cooldownMs: 8_000 })
    const until = Number((await store.circuitState(pool)).open_until)
    expect(until).toBeGreaterThan(before + 7_500)
    expect(until).toBeLessThan(before + 8_500)
  })

  test("renew extends the lease past the original expiry", async () => {
    const lease = await acquire("renew", {
      maxConcurrency: 1,
      leaseTtlMs: 1_000,
    })
    const renewed = await store.renew(lease, 60_000)
    expect(renewed.ok).toBe(true)
    const other = await store.acquire(pool, "other", {
      ...limits,
      maxConcurrency: 1,
      leaseTtlMs: 60_000,
    })
    expect(other.ok).toBe(false)
  })

  test("renew keeps a half-open probe from expiring into a second probe", async () => {
    const seed = await acquire("seed", { maxConcurrency: 10 })
    await store.release(seed, "rate_limited", {
      retryAfterMs: 30,
      cooldownMs: 30,
    })
    await Bun.sleep(50)
    const probe = await acquire("probe", { maxConcurrency: 10, probeTtlMs: 80 })
    await Bun.sleep(40)
    expect((await store.renew(probe, 5_000, 5_000)).ok).toBe(true)
    await Bun.sleep(50)
    const other = await store.acquire(pool, "other", {
      ...limits,
      maxConcurrency: 10,
    })
    expect(other.ok).toBe(false)
    if (!other.ok) expect(other.reason).toBe("circuit_open")
  })

  test("not_sent reopens a probe instead of leaving it half-open", async () => {
    const seed = await acquire("seed", { maxConcurrency: 10 })
    await store.release(seed, "rate_limited", {
      retryAfterMs: 20,
      cooldownMs: 20,
    })
    await Bun.sleep(40)
    const probe = await acquire("probe", { maxConcurrency: 10 })
    await store.release(probe, "not_sent", { cooldownMs: 5_000, burst: 60 })
    const circuit = await store.circuitState(pool)
    expect(circuit.state).toBe("open")
    expect(circuit.probe_id ?? "").not.toBe(probe.leaseId)
  })

  test("expired inflight members are purged", async () => {
    await redis.zadd(store.keys(pool).inflight, 1, randomUUID())
    await acquire("fresh", { maxConcurrency: 1 })
    const members = await redis.zrange(store.keys(pool).inflight, 0, -1)
    expect(members).toHaveLength(1)
  })

  test("a second release is not_found and does not change inflight", async () => {
    const lease = await acquire("r")
    expect((await store.release(lease, "abandoned")).ok).toBe(true)
    expect(await store.release(lease, "abandoned")).toEqual({
      ok: false,
      reason: "not_found",
    })
    expect(await store.inflightCount(pool)).toBe(0)
  })

  test("redis errors fail closed", async () => {
    const broken = new CapacityLeaseStore({
      redis: { eval: async () => Promise.reject(new Error("down")) } as never,
      keyPrefix: prefix,
    })
    const acquired = await broken.acquire(pool, "r", limits)
    expect(acquired.ok).toBe(false)
    if (!acquired.ok) expect(acquired.reason).toBe("unavailable")
    const lease: LeaseHandle = {
      poolId: pool,
      holderId: "r",
      leaseId: randomUUID(),
      epoch: 1,
      expiresAtMs: Date.now(),
    }
    expect((await broken.release(lease, "completed")).ok).toBe(false)
  })

  test("parallel acquires never exceed maxConcurrency", async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        store.acquire(pool, `c${index}`, {
          ...limits,
          maxConcurrency: 5,
          burst: 50,
        }),
      ),
    )
    expect(results.filter((result) => result.ok).length).toBe(5)
    expect(await store.inflightCount(pool)).toBe(5)
  })
})
