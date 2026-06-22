import type Redis from 'ioredis'

const DEFAULT_BLOCK_MS = 5000
const REQUEST_STREAM_PREFIX = 'streams:request'

type InvalidStreamEntryReason = 'missing-type' | 'missing-data' | 'invalid-json'

export type StreamEvent<T = unknown> = {
  type: string
  data: T
  meta?: Record<string, unknown>
}

export type StreamEntry<T = unknown> = {
  id: string
  event: StreamEvent<T>
}

export type InvalidStreamEntry = {
  id: string
  reason: InvalidStreamEntryReason
  raw: Record<string, string>
  error?: string
}

export type MultiStreamTarget = {
  streamKey: string
  requestId: string
  lastEventId?: string
}

export type MultiStreamEntry<T = unknown> = {
  id: string
  requestId: string
  event: StreamEvent<T>
}

type MultiStreamOptions = {
  blockMs?: number
  onInvalidEntry?: (entry: InvalidStreamEntry) => void | Promise<void>
  refreshTargets?: () => Promise<MultiStreamTarget[]>
}

type PushOptions = {
  maxLen?: number
  approximateMaxLen?: boolean
}

type ParsedEntry<T> =
  | { ok: true; entry: StreamEntry<T> }
  | { ok: false; entry: InvalidStreamEntry }

// ---------------------------------------------------------------------------
// Key helpers
// ---------------------------------------------------------------------------

export function requestStreamKey(requestId: string): string {
  return `${REQUEST_STREAM_PREFIX}:${requestId}`
}

// ---------------------------------------------------------------------------
// Stream operations
// ---------------------------------------------------------------------------

export async function pushToRequestStream<T>(
  redis: Redis,
  requestId: string,
  event: StreamEvent<T>,
  options: PushOptions = {}
): Promise<string> {
  const key = requestStreamKey(requestId)
  const args: string[] = []

  if (options.maxLen !== undefined) {
    args.push(
      'MAXLEN',
      options.approximateMaxLen === false ? '=' : '~',
      String(options.maxLen)
    )
  }

  args.push('*', 'type', event.type, 'data', JSON.stringify(event.data))

  if (event.meta !== undefined) {
    args.push('meta', JSON.stringify(event.meta))
  }

  return (await redis.xadd(key, ...args)) as string
}

export async function requestStreamExists(redis: Redis, requestId: string): Promise<boolean> {
  return (await redis.exists(requestStreamKey(requestId))) === 1
}

export async function deleteRequestStream(redis: Redis, requestId: string): Promise<void> {
  await redis.del(requestStreamKey(requestId))
}

/**
 * Non-blocking read of all entries using XRANGE.
 * If afterId is provided, reads entries strictly after that ID.
 */
export async function readRequestStreamRange<T>(
  redis: Redis,
  requestId: string,
  afterId?: string
): Promise<StreamEntry<T>[]> {
  const key = requestStreamKey(requestId)
  const startId = afterId ? exclusiveId(afterId) : '-'
  const rawEntries = await redis.xrange(key, startId, '+')

  const entries: StreamEntry<T>[] = []
  for (const [id, fields] of rawEntries) {
    const parsed = parseFields<T>(id, fields)
    if (parsed.ok) {
      entries.push(parsed.entry)
    }
  }
  return entries
}

// ---------------------------------------------------------------------------
// Multi-stream subscriber
// ---------------------------------------------------------------------------

/**
 * Subscribe to multiple Redis streams in a single blocking XREAD call.
 *
 * Uses `XREAD BLOCK <ms> STREAMS key1 key2 ... id1 id2 ...` so a single
 * Redis connection fans out events from all active request streams.
 *
 * When `refreshTargets` is provided, the target set is refreshed after every
 * XREAD cycle. New streams are picked up automatically and completed ones
 * are dropped.
 */
export async function* subscribeMulti<T = unknown>(
  blockingClient: Redis,
  initialTargets: MultiStreamTarget[],
  options: MultiStreamOptions = {}
): AsyncGenerator<MultiStreamEntry<T>> {
  const { blockMs = DEFAULT_BLOCK_MS, onInvalidEntry, refreshTargets } = options

  const targets = new Map<string, { requestId: string; cursor: string }>()
  for (const t of initialTargets) {
    targets.set(t.streamKey, {
      requestId: t.requestId,
      cursor: t.lastEventId ?? '$',
    })
  }

  while (true) {
    if (targets.size === 0) {
      if (!refreshTargets) return

      await delay(blockMs)
      applyRefresh(targets, await refreshTargets())
      continue
    }

    const streamKeys = [...targets.keys()]
    const cursors = streamKeys.map((k) => targets.get(k)!.cursor)

    const result = await blockingClient.xread(
      'BLOCK',
      blockMs,
      'STREAMS',
      ...streamKeys,
      ...cursors
    )

    if (!result) {
      if (refreshTargets) {
        applyRefresh(targets, await refreshTargets())
      }
      continue
    }

    for (const [streamKey, entries] of result) {
      const target = targets.get(streamKey as string)
      if (!target) continue

      for (const [id, fields] of entries) {
        target.cursor = id

        const parsed = parseFields<T>(id, fields)
        if (!parsed.ok) {
          await onInvalidEntry?.(parsed.entry)
          continue
        }

        yield {
          id,
          requestId: target.requestId,
          event: parsed.entry.event,
        }
      }
    }

    if (refreshTargets) {
      applyRefresh(targets, await refreshTargets())
    }
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function parseFields<T>(id: string, fields: string[]): ParsedEntry<T> {
  const raw: Record<string, string> = {}
  for (let index = 0; index < fields.length; index += 2) {
    raw[fields[index]] = fields[index + 1]
  }

  if (!raw.type) {
    return { ok: false, entry: { id, reason: 'missing-type', raw } }
  }

  if (raw.data == null) {
    return { ok: false, entry: { id, reason: 'missing-data', raw } }
  }

  try {
    return {
      ok: true,
      entry: {
        id,
        event: {
          type: raw.type,
          data: JSON.parse(raw.data) as T,
          meta: raw.meta ? (JSON.parse(raw.meta) as Record<string, unknown>) : undefined,
        },
      },
    }
  } catch (error) {
    return {
      ok: false,
      entry: {
        id,
        reason: 'invalid-json',
        raw,
        error: error instanceof Error ? error.message : 'Unknown parse error',
      },
    }
  }
}

/**
 * Convert a Redis stream ID to its exclusive counterpart for XRANGE.
 * "1234-0" becomes "1234-1", so XRANGE excludes the given ID.
 */
function exclusiveId(id: string): string {
  const parts = id.split('-')
  if (parts.length === 2) {
    const seq = parseInt(parts[1], 10)
    return `${parts[0]}-${seq + 1}`
  }
  return id
}

/**
 * Merge a fresh set of targets into the live cursor map.
 * - New streams are added with cursor '0' (read from beginning).
 * - Streams no longer in the refresh set are dropped.
 * - Existing streams keep their current cursor position.
 */
function applyRefresh(
  current: Map<string, { requestId: string; cursor: string }>,
  freshTargets: MultiStreamTarget[]
) {
  const freshKeys = new Set<string>()

  for (const t of freshTargets) {
    freshKeys.add(t.streamKey)
    if (!current.has(t.streamKey)) {
      current.set(t.streamKey, {
        requestId: t.requestId,
        cursor: t.lastEventId ?? '0',
      })
    }
  }

  for (const key of current.keys()) {
    if (!freshKeys.has(key)) {
      current.delete(key)
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
