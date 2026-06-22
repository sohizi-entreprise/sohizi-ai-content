import type Redis from 'ioredis'
import { createBlockingRedisClient, redis } from '@/lib'
import {
  pushToRequestStream,
  requestStreamExists,
  requestStreamKey,
  readRequestStreamRange,
  subscribeMulti,
  type InvalidStreamEntry,
  type MultiStreamTarget,
} from './event-stream'
import { RequestRegistry, type ActiveRequest } from './request-registry'
import { SSEStreamEvent } from './types'

type WriteRequestEventOptions = {
  requestId: string
  event: SSEStreamEvent
  maxLen?: number
}

type SubscribeActiveRequestsOptions = {
  userId: string
  lastEventIds?: Record<string, string>
  blockingClient?: Redis
  blockMs?: number
  emitHandshake?: boolean
  onInvalidEntry?: (entry: InvalidStreamEntry) => void | Promise<void>
}

/**
 * Write an event to a per-request stream.
 */
export const writeRequestEvent = async (options: WriteRequestEventOptions): Promise<string> => {
  return pushToRequestStream(
    redis,
    options.requestId,
    { type: options.event.event, data: options.event },
    options.maxLen ? { maxLen: options.maxLen } : {}
  )
}

/**
 * Register a request in the user's active-request registry
 * and create its dedicated stream key.
 */
export const startRequest = async (
  userId: string,
  requestId: string,
  type: 'chat-completion' | 'media-generation' | 'caption-generation'
): Promise<void> => {
  const registry = new RequestRegistry(redis, userId)
  await registry.register({
    requestId,
    type,
    streamKey: requestStreamKey(requestId),
  })
}

/**
 * Mark a request as complete: remove from registry and schedule stream
 * deletion after a grace period so the frontend can receive the terminal event.
 */
export const completeRequest = async (
  userId: string,
  requestId: string,
  ttlSeconds?: number
): Promise<void> => {
  const registry = new RequestRegistry(redis, userId)
  await registry.completeRequest(requestId, requestStreamKey(requestId), ttlSeconds)
}

/**
 * Get all active (in-flight) requests for a user.
 */
export const getActiveRequests = async (userId: string): Promise<ActiveRequest[]> => {
  const registry = new RequestRegistry(redis, userId)
  return registry.getActiveRequests()
}

/**
 * The main SSE entry point. Handles both initial connection and reconnection
 * in a single async generator:
 *
 * 1. Reads the registry to find all active (in-flight) requests
 * 2. For each, replays buffered events via XRANGE (non-blocking catchup)
 * 3. Transitions seamlessly into a live multi-stream XREAD BLOCK subscription
 * 4. On every XREAD cycle, re-checks the registry so new requests
 *    are picked up and completed ones are dropped automatically
 *
 * The frontend opens a single SSE connection to this generator. Every yielded
 * event carries a `requestId` so the client can demux by operation.
 */
export async function* subscribeToActiveRequests({
  userId,
  lastEventIds = {},
  blockingClient,
  blockMs,
  emitHandshake = true,
  onInvalidEntry,
}: SubscribeActiveRequestsOptions) {
  const client = blockingClient ?? createBlockingRedisClient()
  const ownsBlockingClient = blockingClient == null

  try {
    if (emitHandshake) {
      yield { data: '' }
    }

    const registry = new RequestRegistry(redis, userId)
    const activeRequests = await registry.getActiveRequests()

    // -- Phase 1: Catchup --
    const catchupCursors: Record<string, string> = { ...lastEventIds }

    if (activeRequests.length > 0) {
      yield {
        event: 'sync-start',
        data: JSON.stringify({
          activeRequests: activeRequests.map((r) => ({
            requestId: r.requestId,
            type: r.type,
            startedAt: r.startedAt,
          })),
        }),
      }

      for (const req of activeRequests) {
        const exists = await requestStreamExists(redis, req.requestId)
        if (!exists) continue

        const afterId = lastEventIds[req.requestId]
        const entries = await readRequestStreamRange(redis, req.requestId, afterId)

        for (const entry of entries) {
          catchupCursors[req.requestId] = entry.id
          yield {
            event: entry.event.type,
            id: entry.id,
            requestId: req.requestId,
            data: JSON.stringify(entry.event.data),
          }
        }
      }

      yield { event: 'sync-end', data: '' }
    }

    // -- Phase 2: Live subscription --
    const initialTargets: MultiStreamTarget[] = activeRequests.map((r) => ({
      streamKey: r.streamKey,
      requestId: r.requestId,
      lastEventId: catchupCursors[r.requestId],
    }))

    const refreshTargets = async (): Promise<MultiStreamTarget[]> => {
      const current = await registry.getActiveRequests()
      return current.map((r) => ({
        streamKey: r.streamKey,
        requestId: r.requestId,
      }))
    }

    await ensureBlockingClientConnected(client)

    for await (const entry of subscribeMulti(client, initialTargets, {
      blockMs,
      onInvalidEntry,
      refreshTargets,
    })) {
      yield {
        event: entry.event.type,
        id: entry.id,
        requestId: entry.requestId,
        data: JSON.stringify(entry.event.data),
      }
    }
  } finally {
    if (ownsBlockingClient) {
      await client.quit().catch(() => {})
    }
  }
}

const ensureBlockingClientConnected = async (client: Redis) => {
  if (client.status === 'wait') {
    await client.connect()
    return
  }

  if (client.status === 'ready' || client.status === 'connect') {
    return
  }

  await new Promise<void>((resolve, reject) => {
    const handleReady = () => {
      cleanup()
      resolve()
    }

    const handleError = (error: Error) => {
      cleanup()
      reject(error)
    }

    const cleanup = () => {
      client.off('ready', handleReady)
      client.off('connect', handleReady)
      client.off('error', handleError)
    }

    client.on('ready', handleReady)
    client.on('connect', handleReady)
    client.on('error', handleError)
  })
}
