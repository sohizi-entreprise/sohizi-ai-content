import type Redis from 'ioredis'
import type { StreamEntry, StreamEvent, StreamEventType } from '@/lib'

const STREAM_TTL_SECONDS = 5
const DEFAULT_BLOCK_MS = 5000

type InvalidStreamEntryReason = 'missing-type' | 'missing-data' | 'invalid-json'

export type InvalidStreamEntry = {
  id: string
  reason: InvalidStreamEntryReason
  raw: Record<string, string>
  error?: string
}

type SubscribeOptions<T> = {
  lastEventId?: string
  blockMs?: number
  isTerminalEvent?: (event: StreamEvent<T>) => boolean
  onInvalidEntry?: (entry: InvalidStreamEntry) => void | Promise<void>
}

type ParsedEntry<T> =
  | { ok: true; entry: StreamEntry<T> }
  | { ok: false; entry: InvalidStreamEntry }

const isTerminalStreamEvent = (event: StreamEvent<unknown>) =>
  event.type.endsWith('_end') || event.type.endsWith('_error')

export class EventStream<T = unknown> {
  readonly streamId: string
  private readonly streamKey: string

  constructor(
    private readonly redis: Redis,
    streamId: string
  ) {
    this.streamId = streamId
    this.streamKey = `stream:${streamId}`
  }

  async push(event: StreamEvent<T>): Promise<string> {
    const eventId = await this.redis.xadd(
      this.streamKey,
      '*',
      'type',
      event.type,
      'data',
      JSON.stringify(event.data)
    )

    return eventId as string
  }

  async close(): Promise<void> {
    await this.redis.expire(this.streamKey, STREAM_TTL_SECONDS)
  }

  async exists(): Promise<boolean> {
    const exists = await this.redis.exists(this.streamKey)
    return exists === 1
  }

  async delete(): Promise<void> {
    await this.redis.del(this.streamKey)
  }

  async *subscribe(
    blockingClient: Redis,
    {
      lastEventId,
      blockMs = DEFAULT_BLOCK_MS,
      isTerminalEvent = isTerminalStreamEvent as (event: StreamEvent<T>) => boolean,
      onInvalidEntry,
    }: SubscribeOptions<T> = {}
  ): AsyncGenerator<StreamEntry<T>> {
    let currentId = lastEventId || '0'

    while (true) {
      const result = await blockingClient.xread(
        'BLOCK',
        blockMs,
        'STREAMS',
        this.streamKey,
        currentId
      )

      if (!result) {
        if (!(await this.exists())) {
          return
        }

        continue
      }

      const [streamData] = result
      const [, entries] = streamData

      for (const [id, fields] of entries) {
        currentId = id

        const parsedEntry = this.parseEntry(id, fields)
        if (!parsedEntry.ok) {
          await onInvalidEntry?.(parsedEntry.entry)
          continue
        }

        yield parsedEntry.entry

        if (isTerminalEvent(parsedEntry.entry.event)) {
          return
        }
      }
    }
  }

  async info(): Promise<{ length: number; firstId: string | null; lastId: string | null }> {
    const info = (await this.redis.xinfo('STREAM', this.streamKey).catch(() => null)) as
      | unknown[]
      | null

    if (!info || !Array.isArray(info)) {
      return { length: 0, firstId: null, lastId: null }
    }

    const infoMap: Record<string, unknown> = {}
    for (let index = 0; index < info.length; index += 2) {
      infoMap[info[index] as string] = info[index + 1]
    }

    return {
      length: (infoMap.length as number) ?? 0,
      firstId: (infoMap['first-entry'] as string[])?.[0] || null,
      lastId: (infoMap['last-entry'] as string[])?.[0] || null,
    }
  }

  private parseEntry(id: string, fields: string[]): ParsedEntry<T> {
    const raw: Record<string, string> = {}
    for (let index = 0; index < fields.length; index += 2) {
      raw[fields[index]] = fields[index + 1]
    }

    if (!raw.type) {
      return {
        ok: false,
        entry: {
          id,
          reason: 'missing-type',
          raw,
        },
      }
    }

    if (raw.data == null) {
      return {
        ok: false,
        entry: {
          id,
          reason: 'missing-data',
          raw,
        },
      }
    }

    try {
      return {
        ok: true,
        entry: {
          id,
          event: {
            type: raw.type as StreamEventType,
            data: JSON.parse(raw.data) as T,
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
}
