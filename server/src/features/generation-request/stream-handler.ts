import { createBlockingRedisClient, redis } from '@/lib'

const DEFAULT_STREAM_TTL_SECONDS = 300
const DEFAULT_ACTIVE_STREAM_TTL_SECONDS = 1800
const ACTIVE_STREAM_GRACE_PERIOD_MS = 15000
const ACTIVE_STREAM_POLL_MS = 250
const ACTIVE_STREAM_KEY_PREFIX = 'active-stream'
const STREAM_COUNTER_KEY_PREFIX = 'stream-counter'

type WriteStreamDataOptions = {
  maxLen?: number
  approximateMaxLen?: boolean
  ttlSeconds?: number
}

type ReadStreamChunksOptions = {
  fromId?: string
  blockMs?: number
}

export type BaseStreamData = {
  event: string;
  runId: string;
}

export type RedisStreamChunk<T = unknown> = {
  id: string
  data: T
}

export async function markStreamActive(
  streamKey: string,
  ttlSeconds = DEFAULT_ACTIVE_STREAM_TTL_SECONDS,
): Promise<void> {
  await redis.set(activeStreamKey(streamKey), '1', 'EX', ttlSeconds)
}

export async function removeStreamActive(streamKey: string): Promise<void> {
  await redis.del(activeStreamKey(streamKey))
}

export async function incrementKey(key: string): Promise<number> {
  const value = await redis.incr(streamCounterKey(key))
  return value
}

export async function decrementKey(key: string): Promise<number | null> {
  const counterKey = streamCounterKey(key)
  const current = await redis.get(counterKey)
  if (!current) return null
  const value = Number(current)
  if (value <= 1) {
    await redis.del(counterKey)
    return 0
  }
  return await redis.decr(counterKey)
}

export async function writeStreamData<T extends BaseStreamData>(
  streamKey: string,
  data: T,
  options: WriteStreamDataOptions = {},
): Promise<string> {
  await ensureStreamKeyIsAvailable(streamKey)

  const args: string[] = []

  if (options.maxLen !== undefined) {
    args.push(
      'MAXLEN',
      options.approximateMaxLen === false ? '=' : '~',
      String(options.maxLen),
    )
  }

  args.push('*', 'data', JSON.stringify(data))

  const id = (await redis.xadd(streamKey, ...args)) as string
  await redis.expire(streamKey, options.ttlSeconds ?? DEFAULT_STREAM_TTL_SECONDS)
  return id
}

export async function* readStreamChunks<T = unknown>(
  streamKey: string,
  options: ReadStreamChunksOptions = {},
): AsyncGenerator<RedisStreamChunk<T>> {
  await ensureStreamKeyIsAvailable(streamKey)

  const client = createBlockingRedisClient()
  let cursor = options.fromId ?? '0'
  let hasSeenActiveStream = await isStreamActive(streamKey)

  try {
    while (true) {
      const result = await client.xread(
        'BLOCK',
        options.blockMs ?? 5000,
        'STREAMS',
        streamKey,
        cursor,
      )
      if (!result) {
        if (!(await isStreamActiveOrBecomesActive(streamKey, hasSeenActiveStream))) {
          yield createDoneChunk<T>(streamKey, cursor)
          break
        }

        hasSeenActiveStream = true
        continue
      }

      const [, entries] = result[0]
      for (const [id, fields] of entries) {
        cursor = id
        yield {
          id,
          data: parseStreamData<T>(fields),
        }
      }

      if (!(await isStreamActiveOrBecomesActive(streamKey, hasSeenActiveStream))) {
        yield createDoneChunk<T>(streamKey, cursor)
        break
      }

      hasSeenActiveStream = true
    }
  } finally {
    await client.quit().catch(() => {})
  }
}

function createDoneChunk<T>(streamKey: string, lastId: string): RedisStreamChunk<T> {
  return {
    id: `${lastId}:done`,
    data: {
      event: 'done',
      runId: streamKey,
    } as T,
  }
}

async function isStreamActive(streamKey: string): Promise<boolean> {
  return (await redis.exists(activeStreamKey(streamKey))) === 1
}

async function isStreamActiveOrBecomesActive(
  streamKey: string,
  hasSeenActiveStream: boolean,
): Promise<boolean> {
  if (await isStreamActive(streamKey)) return true
  if (hasSeenActiveStream) return false
  return waitForStreamActive(streamKey)
}

async function waitForStreamActive(
  streamKey: string,
  timeoutMs = ACTIVE_STREAM_GRACE_PERIOD_MS,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    if (await isStreamActive(streamKey)) return true

    const remainingMs = deadline - Date.now()
    await delay(Math.min(ACTIVE_STREAM_POLL_MS, remainingMs))
  }

  return isStreamActive(streamKey)
}

function activeStreamKey(streamKey: string): string {
  return `${ACTIVE_STREAM_KEY_PREFIX}:${streamKey}`
}

function streamCounterKey(streamKey: string): string {
  return `${STREAM_COUNTER_KEY_PREFIX}:${streamKey}`
}

async function ensureStreamKeyIsAvailable(streamKey: string): Promise<void> {
  const type = await redis.type(streamKey)
  if (type !== 'none' && type !== 'stream') {
    await redis.del(streamKey)
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseStreamData<T>(fields: string[]): T {
  const dataIndex = fields.findIndex((field) => field === 'data')
  if (dataIndex === -1 || dataIndex + 1 >= fields.length) {
    throw new Error('Redis stream entry is missing a data field')
  }

  return JSON.parse(fields[dataIndex + 1]) as T
}
