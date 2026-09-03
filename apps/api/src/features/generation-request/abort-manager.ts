import Redis from "ioredis"
import { redis } from "@/lib"

const CANCELLATION_CHANNEL = "request:cancellations"

type CancellationMessage = {
  id: string
}

/**
 * Create an AbortController that is wired to a Redis Pub/Sub channel.
 * When a cancellation message matching `requestId` is published,
 * the controller is automatically aborted and the subscriber cleaned up.
 *
 * Use this inside Inngest functions (or any process) where you need
 * a real AbortSignal that responds to cross-process cancellation.
 */
export async function createCancellableController(requestId: string): Promise<{
  controller: AbortController
  cleanup: () => Promise<void>
}> {
  const controller = new AbortController()
  const subscriber = redis.duplicate()

  const ensureConnected = async (client: Redis) => {
    if (client.status === "wait") {
      await client.connect()
      return
    }
    if (client.status === "ready" || client.status === "connect") {
      return
    }
    await new Promise<void>((resolve, reject) => {
      const handleReady = () => {
        off()
        resolve()
      }
      const handleError = (err: Error) => {
        off()
        reject(err)
      }
      const off = () => {
        client.off("ready", handleReady)
        client.off("connect", handleReady)
        client.off("error", handleError)
      }
      client.on("ready", handleReady)
      client.on("connect", handleReady)
      client.on("error", handleError)
    })
  }

  await ensureConnected(subscriber)
  await subscriber.subscribe(CANCELLATION_CHANNEL)

  const onMessage = (channel: string, message: string) => {
    if (channel !== CANCELLATION_CHANNEL) return
    const parsed = JSON.parse(message) as CancellationMessage
    if (parsed.id === requestId) {
      controller.abort()
    }
  }

  subscriber.on("message", onMessage)

  const cleanup = async () => {
    subscriber.off("message", onMessage)
    await subscriber.unsubscribe(CANCELLATION_CHANNEL).catch(() => {})
    await subscriber.quit().catch(() => {})
  }

  controller.signal.addEventListener(
    "abort",
    () => {
      cleanup().catch(() => {})
    },
    { once: true },
  )

  return { controller, cleanup }
}

/**
 * Broadcast a cancellation for a request ID.
 * Any process listening via `createCancellableController` will abort.
 */
export async function broadcastCancellation(requestId: string): Promise<void> {
  await redis.publish(CANCELLATION_CHANNEL, JSON.stringify({ id: requestId }))
}
