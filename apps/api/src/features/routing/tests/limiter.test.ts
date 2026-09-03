import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { randomUUID } from "node:crypto"
import { redis } from "@/lib/redis"
import { VendorLimiter } from "../limiter"

const vendor = "limiter-test"
let limiter: VendorLimiter
let prefix: string

const limits = {
  rpm: 60,
  burst: 60,
  maxConcurrency: 2,
  leaseTtlMs: 60_000,
  probeTtlMs: 30_000,
}

beforeEach(async () => {
  prefix = `test:${randomUUID()}:`
  limiter = new VendorLimiter({
    redis,
    keyPrefix: prefix,
    acquireTimeoutMs: 500,
  })
  await limiter.deleteKeys(vendor)
})

afterEach(async () => {
  await limiter.deleteKeys(vendor)
})

describe("VendorLimiter", () => {
  test("caps inflight at maxConcurrency", async () => {
    const a = await limiter.acquire(vendor, "r1", {
      ...limits,
      maxConcurrency: 2,
    })
    const b = await limiter.acquire(vendor, "r2", {
      ...limits,
      maxConcurrency: 2,
    })
    const c = await limiter.acquire(vendor, "r3", {
      ...limits,
      maxConcurrency: 2,
    })
    expect(a.ok).toBe(true)
    expect(b.ok).toBe(true)
    expect(c.ok).toBe(false)
    expect(c.reason).toBe("concurrency")
    expect(await limiter.inflightCount(vendor)).toBe(2)
    await limiter.release(vendor, "r1", { outcome: "none" })
    await limiter.release(vendor, "r2", { outcome: "none" })
  })

  test("same requestId replay does not consume another token or slot", async () => {
    const first = await limiter.acquire(vendor, "same", {
      ...limits,
      burst: 5,
      rpm: 5,
    })
    expect(first.ok).toBe(true)
    const before = await limiter.tokenBucket(vendor)
    const second = await limiter.acquire(vendor, "same", {
      ...limits,
      burst: 5,
      rpm: 5,
    })
    expect(second.ok).toBe(true)
    const after = await limiter.tokenBucket(vendor)
    expect(await limiter.inflightCount(vendor)).toBe(1)
    expect(after.tokens).toBe(before.tokens)
    await limiter.release(vendor, "same", { outcome: "none" })
  })

  test("token bucket rejects after burst then refills", async () => {
    const tight = { rpm: 60, burst: 1, maxConcurrency: 10, leaseTtlMs: 60_000 }
    const first = await limiter.acquire(vendor, "t1", tight)
    const second = await limiter.acquire(vendor, "t2", tight)
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(false)
    expect(second.reason).toBe("rpm")
    await Bun.sleep(1200)
    const third = await limiter.acquire(vendor, "t3", tight)
    expect(third.ok).toBe(true)
    await limiter.release(vendor, "t1", { outcome: "none" })
    await limiter.release(vendor, "t3", { outcome: "none" })
  })

  test("open circuit rejects other request ids until cooldown", async () => {
    expect((await limiter.acquire(vendor, "probe", limits)).ok).toBe(true)
    await limiter.release(vendor, "probe", {
      outcome: "failure",
      retryAfterMs: 5_000,
      cooldownMs: 5_000,
    })
    const next = await limiter.acquire(vendor, "other", limits)
    expect(next.ok).toBe(false)
    expect(next.reason).toBe("circuit_open")
  })

  test("after cooldown exactly one request is admitted as probe", async () => {
    expect(
      (await limiter.acquire(vendor, "seed", { ...limits, maxConcurrency: 50 }))
        .ok,
    ).toBe(true)
    await limiter.release(vendor, "seed", {
      outcome: "failure",
      retryAfterMs: 50,
      cooldownMs: 50,
    })
    await Bun.sleep(200)
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        limiter.acquire(vendor, `p${i}`, { ...limits, maxConcurrency: 50 }),
      ),
    )
    expect(results.filter((r) => r.ok).length).toBe(1)
    expect(
      results.filter((r) => !r.ok && r.reason === "circuit_open").length,
    ).toBe(19)
    const winner = results.findIndex((r) => r.ok)
    await limiter.release(vendor, `p${winner}`, {
      outcome: "none",
      cooldownMs: 50,
    })
  })

  test("probe success closes the circuit", async () => {
    expect(
      (await limiter.acquire(vendor, "seed", { ...limits, maxConcurrency: 10 }))
        .ok,
    ).toBe(true)
    await limiter.release(vendor, "seed", {
      outcome: "failure",
      retryAfterMs: 50,
      cooldownMs: 50,
    })
    await Bun.sleep(200)
    expect(
      (
        await limiter.acquire(vendor, "probe", {
          ...limits,
          maxConcurrency: 10,
        })
      ).ok,
    ).toBe(true)
    await limiter.release(vendor, "probe", {
      outcome: "submit_ok",
      cooldownMs: 50,
    })
    const other = await limiter.acquire(vendor, "other", {
      ...limits,
      maxConcurrency: 10,
    })
    expect(other.ok).toBe(true)
    const circuit = await limiter.circuitState(vendor)
    expect(circuit.state ?? "").not.toBe("open")
    expect(circuit.state ?? "").not.toBe("half_open")
    await limiter.release(vendor, "probe", { outcome: "none" })
    await limiter.release(vendor, "other", { outcome: "none" })
  })

  test("probe failure re-opens the circuit", async () => {
    expect(
      (await limiter.acquire(vendor, "seed", { ...limits, maxConcurrency: 10 }))
        .ok,
    ).toBe(true)
    await limiter.release(vendor, "seed", {
      outcome: "failure",
      retryAfterMs: 50,
      cooldownMs: 50,
    })
    await Bun.sleep(200)
    expect(
      (
        await limiter.acquire(vendor, "probe", {
          ...limits,
          maxConcurrency: 10,
        })
      ).ok,
    ).toBe(true)
    await limiter.release(vendor, "probe", {
      outcome: "failure",
      retryAfterMs: 5_000,
      cooldownMs: 5_000,
    })
    const other = await limiter.acquire(vendor, "other", {
      ...limits,
      maxConcurrency: 10,
    })
    expect(other.ok).toBe(false)
    expect(other.reason).toBe("circuit_open")
  })

  test("expired inflight members are purged", async () => {
    const keys = limiter.keys(vendor)
    await redis.zadd(keys.inflight, 1, "stale")
    const next = await limiter.acquire(vendor, "fresh", {
      ...limits,
      maxConcurrency: 1,
    })
    expect(next.ok).toBe(true)
    const members = await redis.zrange(keys.inflight, 0, -1)
    expect(members).toEqual(["fresh"])
    await limiter.release(vendor, "fresh", { outcome: "none" })
  })

  test("double release is idempotent", async () => {
    expect((await limiter.acquire(vendor, "r", limits)).ok).toBe(true)
    await limiter.release(vendor, "r", { outcome: "none" })
    await limiter.release(vendor, "r", { outcome: "none" })
    expect(await limiter.inflightCount(vendor)).toBe(0)
  })

  test("redis errors fail closed", async () => {
    const broken = new VendorLimiter({
      redis: {
        eval: async () => {
          throw new Error("down")
        },
      } as never,
      keyPrefix: prefix,
    })
    const result = await broken.acquire(vendor, "r", limits)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe("unavailable")
  })

  test("20 parallel acquires honor maxConcurrency=5", async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        limiter.acquire(vendor, `c${i}`, {
          ...limits,
          maxConcurrency: 5,
          burst: 50,
        }),
      ),
    )
    expect(results.filter((r) => r.ok).length).toBe(5)
    expect(await limiter.inflightCount(vendor)).toBe(5)
    await Promise.all(
      results.flatMap((r, i) =>
        r.ok ? [limiter.release(vendor, `c${i}`, { outcome: "none" })] : [],
      ),
    )
  })
})
