import { describe, expect, test } from "bun:test"
import { CapacityLeaseStore } from "./lease-store"
import { userPoolId } from "./user-gate"
import {
  acquireUserSlot,
  releaseUserSlot,
  UserConcurrencyLimitError,
} from "./user-gate"
import { redis } from "@/lib/redis"
import { randomUUID } from "node:crypto"

describe("user concurrency gate", () => {
  test("rejects the request that would exceed the cap", async () => {
    const prefix = `test:${randomUUID()}:`
    const store = new CapacityLeaseStore({ redis, keyPrefix: prefix })
    const leases = []
    try {
      for (let index = 0; index < 5; index++) {
        leases.push(
          await acquireUserSlot({
            userId: "user-a",
            holderId: `job-${index}`,
            task: "media",
            leaseTtlMs: 60_000,
            store,
          }),
        )
      }
      await expect(
        acquireUserSlot({
          userId: "user-a",
          holderId: "job-6",
          task: "media",
          leaseTtlMs: 60_000,
          store,
        }),
      ).rejects.toBeInstanceOf(UserConcurrencyLimitError)
      expect(await store.inflightCount(userPoolId("user-a", "media"))).toBe(5)
      await releaseUserSlot(leases[0], store)
      const next = await acquireUserSlot({
        userId: "user-a",
        holderId: "job-7",
        task: "media",
        leaseTtlMs: 60_000,
        store,
      })
      expect(next).not.toBeNull()
    } finally {
      const keys = await redis.keys(`${prefix}*`)
      if (keys.length > 0) await redis.del(...keys)
    }
  })

  test("a task without a policy does not reject", async () => {
    const lease = await acquireUserSlot({
      userId: "user-b",
      holderId: "job",
      task: "web.search",
      leaseTtlMs: 60_000,
    })
    expect(lease).toBeNull()
  })
})
