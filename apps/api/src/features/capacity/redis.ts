import Redis from "ioredis"

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379"

/** Capacity commands fail closed on this deadline instead of racing a committed eval. */
export const CAPACITY_COMMAND_TIMEOUT_MS = 2_000

export const capacityRedis = new Redis(redisUrl, {
  connectTimeout: CAPACITY_COMMAND_TIMEOUT_MS,
  commandTimeout: CAPACITY_COMMAND_TIMEOUT_MS,
  maxRetriesPerRequest: 1,
  retryStrategy(times) {
    return Math.min(times * 50, 2_000)
  },
  lazyConnect: true,
  enableOfflineQueue: false,
})

capacityRedis.on("error", (error) => {
  console.error("[capacity] redis error", error)
})

let startupConnection: Promise<void> | undefined

/**
 * Make Redis ready before the API accepts requests. Offline queuing remains
 * disabled so capacity decisions fail closed if Redis becomes unavailable.
 */
export function connectCapacityRedis(): Promise<void> {
  if (capacityRedis.status === "ready") return Promise.resolve()

  startupConnection ??= capacityRedis.connect().finally(() => {
    startupConnection = undefined
  })

  return startupConnection
}
