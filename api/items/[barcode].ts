import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth } from '../_lib/auth.js'
import { getItem, setItem, getCachedSuggestion, cacheSuggestion } from '../_lib/storage.js'
import { lookupExternalProduct } from '../_lib/external.js'
import type { View } from '../../src/types.js'

export const config = { runtime: 'nodejs' }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!requireAuth(req)) {
      return res.status(401).json({ error: 'unauthorized' })
    }

    const barcode = req.query.barcode as string

    if (req.method === 'PATCH') {
      const body = req.body as { name?: string; price?: number } | undefined
      const name = body?.name?.trim() || undefined
      const rawPrice = body?.price != null ? parseFloat(String(body.price)) : null
      const price = rawPrice !== null && !isNaN(rawPrice) ? rawPrice : null

      let item = await getItem(barcode)
      if (!item) {
        if (!name) return res.status(400).json({ error: 'name required for new item' })
        const now = new Date().toISOString()
        item = {
          barcode,
          name,
          needs_photos: true,
          required_views: ['front', 'back'] as View[],
          photo_urls: {},
          created_at: now,
          updated_at: now,
        }
      } else {
        if (name) item.name = name
      }
      if (price !== null) item!.price = price
      item!.updated_at = new Date().toISOString()
      await setItem(item!)
      return res.json({ item })
    }

    // GET
    const item = await getItem(barcode)
    if (item) {
      return res.json({ exists: true, item })
    }

    const cached = await getCachedSuggestion(barcode)
    const suggestion = cached ?? await lookupExternalProduct(barcode)
    if (!cached) await cacheSuggestion(barcode, suggestion)
    return res.json({ exists: false, suggestion })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: String(err) })
  }
}
