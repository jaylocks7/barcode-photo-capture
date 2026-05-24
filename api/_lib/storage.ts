import { createClient } from 'redis'
import { AwsClient } from 'aws4fetch'
import type { ItemRecord } from '../../src/types'

const redis = await createClient({ url: process.env.REDIS_URL }).connect()

const aws = new AwsClient({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  region: process.env.AWS_REGION!,
  service: 's3',
})

export const itemKey = (barcode: string) => `item:${barcode}`

export async function getItem(barcode: string): Promise<ItemRecord | null> {
  const val = await redis.get(itemKey(barcode))
  return val ? JSON.parse(val) as ItemRecord : null
}

export async function setItem(item: ItemRecord): Promise<void> {
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
  const res = await aws.fetch(url, {
    method: 'PUT',
    body: params.body,
    headers: { 'Content-Type': params.contentType },
  })
  if (!res.ok) throw new Error(`S3 PUT failed: ${res.status}`)
  return url
}
