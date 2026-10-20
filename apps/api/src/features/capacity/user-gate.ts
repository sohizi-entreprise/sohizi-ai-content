import { TooManyRequests } from "@/features/error"
import {
  CapacityLeaseStore,
  leaseStore as defaultLeaseStore,
} from "./lease-store"
import { releaseCapacityLease, renewCapacityLease } from "./router"
import { userConcurrencyFor, userTaskKey } from "./registry"
import type { LeaseHandle } from "./types"

export class UserConcurrencyLimitError extends Error {
  constructor(
    readonly task: string,
    readonly limit: number,
  ) {
    super(`Too many in-flight ${task} jobs. Limit is ${limit}.`)
    this.name = "UserConcurrencyLimitError"
  }
}

export function userPoolId(userId: string, task: string): string {
  const key = userTaskKey(task) ?? task
  return `user:${userId}:${key}`
}

export async function acquireUserSlot(input: {
  userId: string
  holderId: string
  task: string
  leaseTtlMs: number
  store?: CapacityLeaseStore
}): Promise<LeaseHandle | null> {
  const limit = userConcurrencyFor(input.task)
  if (limit === undefined) return null
  const store = input.store ?? defaultLeaseStore
  const acquired = await store.acquire(
    userPoolId(input.userId, input.task),
    input.holderId,
    { rpm: 0, burst: 0, maxConcurrency: limit, leaseTtlMs: input.leaseTtlMs },
  )
  if (!acquired.ok) {
    throw new UserConcurrencyLimitError(
      userTaskKey(input.task) ?? input.task,
      limit,
    )
  }
  return acquired.lease
}

export async function renewUserSlot(
  lease: LeaseHandle | null | undefined,
  leaseTtlMs: number,
  store?: CapacityLeaseStore,
) {
  if (!lease) return { ok: true as const }
  return renewCapacityLease(lease, leaseTtlMs, undefined, store)
}

export async function releaseUserSlot(
  lease: LeaseHandle | null | undefined,
  store?: CapacityLeaseStore,
) {
  if (!lease) return { ok: true as const }
  return releaseCapacityLease(lease, "completed", {}, store)
}

export function userLimitToHttp(
  error: UserConcurrencyLimitError,
): TooManyRequests {
  return new TooManyRequests(error.message, 5_000)
}
