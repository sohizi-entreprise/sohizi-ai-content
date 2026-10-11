import { describe, expect, test } from "bun:test"
import { functions } from "@/lib/inngest"
import {
  runSweepBatches,
  sweepBillingReservations,
  sweepBillingWallets,
} from "./inngest"

describe("billing expiration schedule", () => {
  test("registers independent one-minute crons with bounded concurrency and retries", () => {
    for (const [fn, id] of [
      [sweepBillingReservations, "billing-reservation-expiration-sweep"],
      [sweepBillingWallets, "billing-wallet-expiration-sweep"],
    ] as const) {
      expect(functions).toContain(fn)
      expect(fn.opts).toMatchObject({
        id,
        triggers: [{ cron: "* * * * *" }],
        concurrency: { limit: 1 },
        retries: 3,
      })
    }
  })

  test("drains full batches and stops after a partial batch", async () => {
    const counts = [2, 2, 1]
    const ids: string[] = []
    const result = await runSweepBatches({
      name: "wallets",
      batchSize: 2,
      maxBatches: 5,
      sweep: async () => counts.shift() ?? 0,
      run: async (id, fn) => {
        ids.push(id)
        return fn()
      },
    })
    expect(result).toEqual({ processed: 5, backlogPossible: false })
    expect(ids).toEqual(["wallets-0", "wallets-1", "wallets-2"])
  })

  test("caps catch-up work and propagates failures for Inngest retries", async () => {
    const capped = await runSweepBatches({
      name: "reservations",
      batchSize: 2,
      maxBatches: 3,
      sweep: async () => 2,
      run: async (_id, fn) => fn(),
    })
    expect(capped).toEqual({ processed: 6, backlogPossible: true })

    await expect(
      runSweepBatches({
        name: "wallets",
        sweep: async () => {
          throw new Error("database unavailable")
        },
        run: async (_id, fn) => fn(),
      }),
    ).rejects.toThrow("database unavailable")
  })
})
