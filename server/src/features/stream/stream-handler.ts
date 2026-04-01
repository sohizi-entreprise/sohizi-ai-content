import type Redis from 'ioredis'
import { createBlockingRedisClient, redis } from '@/lib'
import { EventStream, type InvalidStreamEntry } from './event-stream'
import { SSEStreamEvent } from './types'

type ReadStreamOptions = {
  streamId: string
  lastEventId?: string
  blockingClient?: Redis
  emitHandshake?: boolean
  onInvalidEntry?: (entry: InvalidStreamEntry) => void | Promise<void>
}

export const writeStreamEvent = async (
  streamId: string,
  event: SSEStreamEvent
) => {
  const stream = new EventStream<SSEStreamEvent>(redis, streamId)
  return stream.push({
    type: event.event,
    data: event,
  })
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

export async function* readStreamEvents<T = unknown>({
  streamId,
  lastEventId,
  blockingClient,
  emitHandshake = true,
  onInvalidEntry,
}: ReadStreamOptions) {
  const stream = new EventStream<T>(redis, streamId)
  const client = blockingClient ?? createBlockingRedisClient()
  const ownsBlockingClient = blockingClient == null

  try {
    if (emitHandshake) {
      // Ensures the response is treated as text/event-stream immediately.
      yield { data: '' }
    }

    const exists = await stream.exists()
    if (!exists) {
      yield {
        event: 'empty',
        data: '',
      }
      return
    }

    await ensureBlockingClientConnected(client)

    for await (const entry of stream.subscribe(client, { lastEventId, onInvalidEntry })) {
      yield {
        event: entry.event.type,
        id: entry.id,
        data: JSON.stringify(entry.event.data),
      }
    }
  } finally {
    if (ownsBlockingClient) {
      await client.quit().catch(() => {})
    }
  }
}