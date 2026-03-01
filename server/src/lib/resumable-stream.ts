import type Redis from 'ioredis'

type ConceptEventType = 'concept_start' | 'concept_delta' | 'concept_end' | 'concept_error' | 'concept_reasoning'
type SynopsisEventType = 'synopsis_start' | 'synopsis_delta' | 'synopsis_end' | 'synopsis_error' | 'synopsis_reasoning'
type EditorEventType = 'editor_start' | 'editor_delta' | 'editor_end' | 'editor_error' | 'editor_reasoning' | 'editor_tool_call' | 'editor_tool_result'

export type StreamEventType = ConceptEventType | SynopsisEventType | EditorEventType

// DOMAIN_EVENT = CONCEPT_CHUNK, CONCEPT_FINISH, CONCEPT_ERROR

export type StreamEvent<T = unknown> = {
  type: StreamEventType
  data: T
}

export type StreamEntry<T = unknown> = {
  id: string
  event: StreamEvent<T>
}

const STREAM_TTL_SECONDS = 5 // Keep stream for 5s after completion for late subscribers
const CANCEL_FLAG_TTL_SECONDS = 300 // Cancel flag expires after 5 minutes

export class ResumableStream<T = unknown> {
  private readonly streamKey: string
  private readonly cancelKey: string

  constructor(
    private readonly redis: Redis,
    projectId: string
  ) {
    this.streamKey = `stream:${projectId}`
    this.cancelKey = `stream:${projectId}:cancel`
  }

  /**
   * Push an event to the stream
   * @returns The event ID assigned by Redis
   */
  async push(event: StreamEvent<T>): Promise<string> {
    const eventId = await this.redis.xadd(
      this.streamKey,
      '*', // Auto-generate ID
      'type', event.type,
      'data', JSON.stringify(event.data)
    )
    return eventId as string
  }

  /**
   * Close the stream with a done event and schedule cleanup
   */
  async close(): Promise<void> {
    
    // Schedule stream deletion after TTL
    await this.redis.expire(this.streamKey, STREAM_TTL_SECONDS)
    
    // Clean up cancel flag
    await this.redis.del(this.cancelKey)
  }

  /**
   * Set the cancel flag
   */
  async cancel(): Promise<void> {
    await this.redis.set(this.cancelKey, '1', 'EX', CANCEL_FLAG_TTL_SECONDS)
  }

  /**
   * Check if the stream has been cancelled
   */
  async isCancelled(): Promise<boolean> {
    const value = await this.redis.get(this.cancelKey)
    return value === '1'
  }

  /**
   * Subscribe to the stream and yield events
   * @param lastEventId - Start reading after this ID (for resumption)
   * @param blockingClient - A separate Redis client for blocking reads
   */
  async *subscribe(
    blockingClient: Redis,
    lastEventId?: string
  ): AsyncGenerator<StreamEntry<T>> {
    // Start from the beginning or after the last event ID
    let currentId = lastEventId || '0'

    while (true) {
      // XREAD with BLOCK waits for new entries
      const result = await blockingClient.xread(
        'BLOCK', 5000, // Block for 5 seconds max
        'STREAMS', this.streamKey, currentId
      )

      if (!result) {
        // Check if stream still exists (might have been deleted after completion)
        const exists = await this.redis.exists(this.streamKey)
        if (!exists) {
          return // Stream was cleaned up, we're done
        }
        continue // Timeout, try again
      }

      // Parse the result: [[streamKey, [[id, [field, value, field, value, ...]], ...]]]
      const [streamData] = result
      const [, entries] = streamData

      for (const [id, fields] of entries) {
        // Parse fields array into object
        const fieldMap: Record<string, string> = {}
        for (let i = 0; i < fields.length; i += 2) {
          fieldMap[fields[i]] = fields[i + 1]
        }

        const event: StreamEvent<T> = {
          type: fieldMap.type as StreamEventType,
          data: JSON.parse(fieldMap.data) as T,
        }

        yield { id, event }

        // Update current ID for next read
        currentId = id

        // If this is a terminal event, stop
        if (event.type.endsWith('_end') || event.type.endsWith('_error')) {
          return
        }
      }
    }
  }

  /**
   * Check if stream exists
   */
  async exists(): Promise<boolean> {
    const exists = await this.redis.exists(this.streamKey)
    return exists === 1
  }

  /**
   * Delete the stream immediately
   */
  async delete(): Promise<void> {
    await this.redis.del(this.streamKey, this.cancelKey)
  }

  /**
   * Get stream info (for debugging)
   */
  async info(): Promise<{ length: number; firstId: string | null; lastId: string | null }> {
    const info = await this.redis.xinfo('STREAM', this.streamKey).catch(() => null) as unknown[] | null
    if (!info || !Array.isArray(info)) {
      return { length: 0, firstId: null, lastId: null }
    }

    // Parse XINFO response (array of key-value pairs)
    const infoMap: Record<string, unknown> = {}
    for (let i = 0; i < info.length; i += 2) {
      infoMap[info[i] as string] = info[i + 1]
    }

    return {
      length: infoMap['length'] as number ?? 0,
      firstId: (infoMap['first-entry'] as string[])?.[0] || null,
      lastId: (infoMap['last-entry'] as string[])?.[0] || null,
    }
  }
}
