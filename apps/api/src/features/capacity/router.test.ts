import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { redis } from "@/lib/redis"
import { CapacityLeaseStore } from "./lease-store"
import { accountPoolId, registerProvider, unregisterProvider } from "./registry"
import {
  CapacityBusyError,
  NoCapacityRouteError,
  runWithCapacity,
  tryAcquireCapacity,
} from "./router"
import type { CapacityBinding } from "./bindings"

const A = "router-a"
const B = "router-b"
let store: CapacityLeaseStore
let prefix: string

const bindings = (): CapacityBinding[] => [
  { providerName: A, adapter: A, apiName: "api-a", priority: 10 },
  { providerName: B, adapter: B, apiName: "api-b", priority: 20 },
]

function register(name: string, maxConcurrency = 2) {
  registerProvider({
    name,
    adapter: name,
    tasks: ["media"],
    strategy: "priority",
    accounts: [
      {
        id: `${name}:test`,
        limits: {
          rpm: 60,
          burst: 60,
          maxConcurrency,
          probeTtlMs: 30_000,
          cooldownMs: 15_000,
        },
        credential: () => "secret",
      },
    ],
  })
}

beforeEach(() => {
  prefix = `test:${randomUUID()}:`
  store = new CapacityLeaseStore({ redis, keyPrefix: prefix })
  register(A)
  register(B)
})

afterEach(async () => {
  unregisterProvider(A)
  unregisterProvider(B)
  const keys = await redis.keys(`${prefix}*`)
  if (keys.length > 0) await redis.del(...keys)
})

describe("capacity router", () => {
  test("priority acquires the first account", async () => {
    const acquired = await tryAcquireCapacity({
      task: "media:model",
      holderId: "r1",
      leaseTtlMs: 60_000,
      bindings: bindings(),
      store,
    })
    expect(acquired.ok).toBe(true)
    if (acquired.ok) expect(acquired.selection.account.id).toBe(`${A}:test`)
  })

  test("a full first account falls through to the next", async () => {
    await store.acquire(accountPoolId(`${A}:test`), "fill-1", {
      rpm: 60,
      burst: 60,
      maxConcurrency: 1,
      leaseTtlMs: 60_000,
    })
    register(A, 1)
    const acquired = await tryAcquireCapacity({
      task: "media:model",
      holderId: "r2",
      leaseTtlMs: 60_000,
      bindings: bindings(),
      store,
    })
    expect(acquired.ok).toBe(true)
    if (acquired.ok) expect(acquired.selection.account.providerName).toBe(B)
  })

  test("account failure opens the circuit and the next account serves", async () => {
    const value = await runWithCapacity({
      task: "media:model",
      holderId: "r3",
      leaseTtlMs: 60_000,
      bindings: bindings(),
      store,
      classify: () => "account_failure",
      run: async ({ account }) => {
        if (account.providerName === A) throw new Error("429")
        return account.providerName
      },
    })
    expect(value).toBe(B)
    expect((await store.circuitState(accountPoolId(`${A}:test`))).state).toBe(
      "open",
    )
  })

  test("a 429 retry hint pauses that account and the next account serves immediately", async () => {
    const before = Date.now()
    const value = await runWithCapacity({
      task: "media:model",
      holderId: "retry-hint",
      leaseTtlMs: 60_000,
      bindings: bindings(),
      store,
      classify: () => "account_failure",
      run: async ({ account }) => {
        if (account.providerName === A) {
          throw Object.assign(new Error("limited"), {
            statusCode: 429,
            retryAfterMs: 4_000,
          })
        }
        return account.providerName
      },
    })
    expect(value).toBe(B)
    const until = Number(
      (await store.circuitState(accountPoolId(`${A}:test`))).open_until,
    )
    expect(until).toBeGreaterThan(before + 3_500)
    expect(until).toBeLessThan(before + 4_500)
  })

  test("a non-429 account failure keeps the registry cooldown", async () => {
    const before = Date.now()
    await runWithCapacity({
      task: "media:model",
      holderId: "server-hint",
      leaseTtlMs: 60_000,
      bindings: bindings(),
      store,
      classify: () => "account_failure",
      run: async ({ account }) => {
        if (account.providerName === A) {
          throw Object.assign(new Error("down"), {
            statusCode: 500,
            retryAfterMs: 4_000,
          })
        }
        return account.providerName
      },
    })
    const until = Number(
      (await store.circuitState(accountPoolId(`${A}:test`))).open_until,
    )
    expect(until).toBeGreaterThan(before + 14_000)
  })

  test("a client failure does not walk the rest of the bindings", async () => {
    const seen: string[] = []
    await expect(
      runWithCapacity({
        task: "media:model",
        holderId: "r4",
        leaseTtlMs: 60_000,
        bindings: bindings(),
        store,
        classify: () => "client_failure",
        run: async ({ account }) => {
          seen.push(account.providerName)
          throw new Error("bad request")
        },
      }),
    ).rejects.toThrow("bad request")
    expect(seen).toEqual([A])
    expect(await store.inflightCount(accountPoolId(`${A}:test`))).toBe(0)
  })

  test("no enabled account is a distinct no-route error", async () => {
    await expect(
      runWithCapacity({
        task: "media:missing",
        holderId: "r5",
        leaseTtlMs: 60_000,
        bindings: [],
        store,
        classify: () => "client_failure",
        run: async () => "nope",
      }),
    ).rejects.toBeInstanceOf(NoCapacityRouteError)
  })

  test("a saturated acquire can be waited out", async () => {
    register(A, 1)
    await store.acquire(accountPoolId(`${A}:test`), "fill", {
      rpm: 60,
      burst: 60,
      maxConcurrency: 1,
      leaseTtlMs: 400,
    })
    const value = await runWithCapacity({
      task: "media:model",
      holderId: "waiter",
      leaseTtlMs: 60_000,
      waitMs: 2_000,
      bindings: [bindings()[0]!],
      store,
      classify: () => "client_failure",
      run: async () => "served",
    })
    expect(value).toBe("served")
  })

  test("waiting gives up with a busy error", async () => {
    register(A, 1)
    await store.acquire(accountPoolId(`${A}:test`), "fill", {
      rpm: 60,
      burst: 60,
      maxConcurrency: 1,
      leaseTtlMs: 60_000,
    })
    await expect(
      runWithCapacity({
        task: "media:model",
        holderId: "busy",
        leaseTtlMs: 60_000,
        waitMs: 0,
        bindings: [bindings()[0]!],
        store,
        classify: () => "client_failure",
        run: async () => "served",
      }),
    ).rejects.toBeInstanceOf(CapacityBusyError)
  })

  test("the same holder does not take a second slot", async () => {
    const first = await tryAcquireCapacity({
      task: "media:model",
      holderId: "same",
      leaseTtlMs: 60_000,
      bindings: bindings(),
      store,
    })
    const second = await tryAcquireCapacity({
      task: "media:model",
      holderId: "same",
      leaseTtlMs: 60_000,
      bindings: bindings(),
      store,
    })
    expect(first.ok && second.ok).toBe(true)
    if (first.ok && second.ok) {
      expect(second.selection.lease.leaseId).toBe(first.selection.lease.leaseId)
    }
    expect(await store.inflightCount(accountPoolId(`${A}:test`))).toBe(1)
  })
})
