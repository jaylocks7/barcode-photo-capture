import { createClient } from 'redis'
import type { ItemRecord } from '../src/types.ts'

const redis = await createClient({ url: process.env.REDIS_URL }).connect()

const PLACEHOLDER = 'https://placehold.co/300x300.png'

const items: ItemRecord[] = [
  {
    barcode: '028400090307',
    name: "Lay's Classic Chips",
    needs_photos: true,
    required_views: ['front', 'back'],
    photo_urls: { front: PLACEHOLDER },
    raw_photo_urls: { front: PLACEHOLDER },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    barcode: '038000138416',
    name: 'Pringles Original',
    needs_photos: true,
    required_views: ['front', 'back', 'top'],
    photo_urls: {},
    raw_photo_urls: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    barcode: '012345678905',
    name: 'Coca-Cola Can 12oz',
    needs_photos: false,
    required_views: ['front', 'back'],
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
