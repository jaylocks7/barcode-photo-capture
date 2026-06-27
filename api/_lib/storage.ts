import { createClient } from 'redis'
import { AwsClient } from 'aws4fetch'
import type { ItemRecord } from '../../src/types'

let _redis: ReturnType<typeof createClient> | null = null

async function getRedis() {
  if (!_redis) {
    _redis = await createClient({ url: process.env.REDIS_URL }).connect()
  }
  return _redis
}

function getAws() {
  return new AwsClient({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    region: process.env.AWS_REGION!,
    service: 's3',
  })
}

export const itemKey = (barcode: string) => `item:${barcode}`
export const suggestionKey = (barcode: string) => `suggestion:${barcode}`

export async function getCachedSuggestion(barcode: string): Promise<{ name: string } | null> {
  const redis = await getRedis()
  const val = await redis.get(suggestionKey(barcode))
  return val ? JSON.parse(val) : null
}

export async function cacheSuggestion(barcode: string, suggestion: { name: string }): Promise<void> {
  const redis = await getRedis()
  // ponytail: EX 86400 = 24h TTL
  await redis.set(suggestionKey(barcode), JSON.stringify(suggestion), { EX: 86400 })
}

export async function getItem(barcode: string): Promise<ItemRecord | null> {
  const redis = await getRedis()
  const val = await redis.get(itemKey(barcode))
  return val ? JSON.parse(val) as ItemRecord : null
}

export async function setItem(item: ItemRecord): Promise<void> {
  const redis = await getRedis()
  await redis.set(itemKey(item.barcode), JSON.stringify(item))
}

export async function uploadToS3(params: {
  key: string
  body: ArrayBuffer | Uint8Array
  contentType: string
}): Promise<string> {
  const bucket = process.env.S3_BUCKET!
  const region = process.env.AWS_REGION!
  const url = `https://${bucket}.s3.${region}.amazonaws.com/${params.key}`
  console.log('S3 PUT', url)
  const res = await getAws().fetch(url, {
    method: 'PUT',
    body: params.body,
    headers: { 'Content-Type': params.contentType },
  })
  if (!res.ok) throw new Error(`S3 PUT failed: ${res.status}`)
  return url
}
