import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAuth } from '../_lib/auth.js'
import { getItem } from '../_lib/storage.js'
import { lookupExternalProduct } from '../_lib/external.js'

export const config = { runtime: 'nodejs' }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!requireAuth(req)) {
      return res.status(401).json({ error: 'unauthorized' })
    }

    const barcode = req.query.barcode as string

    const item = await getItem(barcode)
    if (item) {
      return res.json({ exists: true, item })
    }

    const suggestion = await lookupExternalProduct(barcode)
    return res.json({ exists: false, suggestion })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: String(err) })
  }
}
