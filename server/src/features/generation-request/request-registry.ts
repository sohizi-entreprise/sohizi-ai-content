import type Redis from 'ioredis'

const REGISTRY_PREFIX = 'active-requests'
const DEFAULT_STREAM_TTL_SECONDS = 120

export type RequestType = 'chat-completion' | 'media-generation' | 'caption-generation'

export type ActiveRequest = {
  requestId: string
  type: RequestType
  streamKey: string
  startedAt: number
}

type RegisterOptions = {
  requestId: string
  type: RequestType
  streamKey: string
}

export class RequestRegistry {
  private readonly registryKey: string

  constructor(
    private readonly redis: Redis,
    userId: string
  ) {
    this.registryKey = `${REGISTRY_PREFIX}:${userId}`
  }

  async register(options: RegisterOptions): Promise<void> {
    const entry: ActiveRequest = {
      requestId: options.requestId,
      type: options.type,
      streamKey: options.streamKey,
      startedAt: Date.now(),
    }
    await this.redis.hset(this.registryKey, options.requestId, JSON.stringify(entry))
  }

  async unregister(requestId: string): Promise<void> {
    await this.redis.hdel(this.registryKey, requestId)
  }

  async getActiveRequests(): Promise<ActiveRequest[]> {
    const entries = await this.redis.hgetall(this.registryKey)
    return Object.values(entries).map((raw) => JSON.parse(raw) as ActiveRequest)
  }

  async has(requestId: string): Promise<boolean> {
    return (await this.redis.hexists(this.registryKey, requestId)) === 1
  }

  /**
   * Unregister the request and schedule its stream key for deletion.
   * The TTL gives the frontend time to receive the terminal event before
   * the stream disappears.
   */
  async completeRequest(
    requestId: string,
    streamKey: string,
    ttlSeconds: number = DEFAULT_STREAM_TTL_SECONDS
  ): Promise<void> {
    await Promise.all([
      this.redis.hdel(this.registryKey, requestId),
      this.redis.expire(streamKey, ttlSeconds),
    ])
  }
}
