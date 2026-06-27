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

type StreamCursor = {
  requestId: string
  cursor: string
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

  const targets = new Map<string, StreamCursor>()
  for (const t of initialTargets) {
    targets.set(t.streamKey, {
      requestId: t.requestId,
      cursor: t.lastEventId ?? '$',
    })
  }

  // A literal '$' cursor is re-resolved by Redis to "latest" on every XREAD
  // call, so any entry that arrives between calls (e.g. while a busier stream
  // keeps XREAD returning immediately) is silently skipped. Resolve it once to
  // a concrete id so the cursor advances deterministically and never drops
  // events.
  await resolveDollarCursors(blockingClient, targets)

  /**
   * Reconcile the live read-set with the registry. New streams are added,
   * but streams that disappeared are *drained* (a final XRANGE flushes any
   * buffered tail, including the terminal complete/error event) before being
   * removed. Without this, completing a request — which removes it from the
   * registry immediately while keeping the stream alive via TTL — would
   * abandon any events the blocking read had not yet consumed.
   */
  async function* reconcileTargets(): AsyncGenerator<MultiStreamEntry<T>> {
    if (!refreshTargets) return

    const fresh = await refreshTargets()
    const freshKeys = new Set(fresh.map((t) => t.streamKey))

    for (const t of fresh) {
      if (!targets.has(t.streamKey)) {
        targets.set(t.streamKey, {
          requestId: t.requestId,
          cursor: t.lastEventId ?? '0',
        })
      }
    }

    for (const [streamKey, target] of [...targets.entries()]) {
      if (freshKeys.has(streamKey)) continue
      yield* drainStream<T>(blockingClient, streamKey, target, onInvalidEntry)
      targets.delete(streamKey)
    }
  }

  while (true) {
    if (targets.size === 0) {
      if (!refreshTargets) return

      await delay(blockMs)
      yield* reconcileTargets()
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
      yield* reconcileTargets()
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

    yield* reconcileTargets()
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
 * Read every remaining entry of a stream (strictly after its current cursor)
 * in a single non-blocking XRANGE. Used to flush a completed stream's tail
 * before it is removed from the live read-set, advancing the cursor as it goes.
 */
async function* drainStream<T>(
  client: Redis,
  streamKey: string,
  target: StreamCursor,
  onInvalidEntry?: MultiStreamOptions['onInvalidEntry']
): AsyncGenerator<MultiStreamEntry<T>> {
  const startId = target.cursor === '0' ? '0' : exclusiveId(target.cursor)
  const rawEntries = await client.xrange(streamKey, startId, '+')

  for (const [id, fields] of rawEntries) {
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

/**
 * Replace any literal '$' cursor with the stream's current last id (or '0' if
 * the stream is empty). This preserves "only new entries" semantics while
 * giving us a concrete, monotonically advancing cursor that Redis won't
 * re-resolve to "latest" on every XREAD.
 */
async function resolveDollarCursors(
  client: Redis,
  targets: Map<string, StreamCursor>
): Promise<void> {
  for (const [streamKey, target] of targets) {
    if (target.cursor !== '$') continue
    const last = await client.xrevrange(streamKey, '+', '-', 'COUNT', 1)
    target.cursor = last.length > 0 ? last[0][0] : '0'
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
