import { createClient } from 'redis'

const redis = await createClient({ url: process.env.REDIS_URL }).connect()

await redis.flushDb()
console.log('DB flushed.')
process.exit(0)
