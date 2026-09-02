import Redis from 'ioredis'

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000)
    return delay
  },
  lazyConnect: true,
})

// For blocking operations like XREAD, we need a separate connection
export const createBlockingRedisClient = () => {
  return new Redis(redisUrl, {
    maxRetriesPerRequest: null, // Disable for blocking operations
    enableReadyCheck: false,
  })
}

redis.on('error', (err) => {
  console.error('Redis connection error:', err)
})

redis.on('connect', () => {
  console.log('Redis connected')
})
