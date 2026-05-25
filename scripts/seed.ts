import { createClient } from 'redis'
import type { ItemRecord } from '../src/types.ts'

const redis = await createClient({ url: process.env.REDIS_URL }).connect()

const PLACEHOLDER = 'https://placehold.co/300x300.png'

const items: ItemRecord[] = [
  {
    barcode: '096619926626',
    name: "Kirkland Fish Oil 1000mg",
    needs_photos: true,
    required_views: ['front', 'back', 'top'],
    photo_urls: { front: PLACEHOLDER },
    raw_photo_urls: { front: PLACEHOLDER },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    barcode: '016500558415',
    name: 'One A Day Mens Multivitamin',
    needs_photos: false,
    required_views: ['front', 'back', 'top'],
    photo_urls: { front: PLACEHOLDER, back: PLACEHOLDER, top: PLACEHOLDER },
    raw_photo_urls: { front: PLACEHOLDER, back: PLACEHOLDER, top: PLACEHOLDER },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    barcode: '012345678905',
    name: 'Coca-Cola Can 12oz',
    needs_photos: true,
    required_views: ['front', 'back', 'top'],
    photo_urls: { front: PLACEHOLDER, back: PLACEHOLDER },
    raw_photo_urls: { front: PLACEHOLDER, back: PLACEHOLDER },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]

for (const item of items) {
  await redis.set(`item:${item.barcode}`, JSON.stringify(item))
  console.log(`Seeded: ${item.name} (${item.barcode})`)
}

console.log('Done.')
process.exit(0)
