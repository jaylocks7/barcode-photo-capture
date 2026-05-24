import type { VercelRequest, VercelResponse } from '@vercel/node'
import Busboy from 'busboy'
import { requireAuth } from '../../_lib/auth.js'
import { getItem, setItem, uploadToS3 } from '../../_lib/storage.js'
import { callRemoveBg } from '../../_lib/external.js'
import type { ItemRecord, View } from '../../../src/types.js'

export const config = {
  runtime: 'nodejs',
  api: { bodyParser: false },
}

const VALID_VIEWS: View[] = ['front', 'back', 'top']

function newItemRecord(params: { barcode: string; name: string }): ItemRecord {
  const now = new Date().toISOString()
  return {
    barcode: params.barcode,
    name: params.name,
    needs_photos: true,
    required_views: ['front', 'back'],
    photo_urls: {},
    raw_photo_urls: {},
    created_at: now,
    updated_at: now,
  }
}

function parseForm(req: VercelRequest): Promise<{ fields: Record<string, string>; imageBuffer: Buffer }> {
  return new Promise((resolve, reject) => {
    const bb = Busboy({ headers: req.headers as Record<string, string> })
    const fields: Record<string, string> = {}
    let imageBuffer: Buffer | null = null

    bb.on('field', (name, value) => { fields[name] = value })
    bb.on('file', (_name, file) => {
      const chunks: Buffer[] = []
      file.on('data', (chunk: Buffer) => chunks.push(chunk))
      file.on('end', () => { imageBuffer = Buffer.concat(chunks) })
    })
    bb.on('finish', () => {
      if (!imageBuffer) return reject(new Error('no image in request'))
      resolve({ fields, imageBuffer })
    })
    bb.on('error', reject)

    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => bb.end(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!requireAuth(req)) {
      return res.status(401).json({ error: 'unauthorized' })
    }

    const barcode = req.query.barcode as string
    const { fields, imageBuffer } = await parseForm(req)

    const view = fields.view
    if (!VALID_VIEWS.includes(view as View)) {
      return res.status(400).json({ error: 'view must be one of: front, back, top' })
    }

    const name = fields.name ?? null

    let item = await getItem(barcode)
    if (!item) {
      if (!name) return res.status(400).json({ error: 'name required for new item' })
      item = newItemRecord({ barcode, name })
    }

    const rawUrl = await uploadToS3({
      key: `items/${barcode}/${view}-raw.jpg`,
      body: imageBuffer,
      contentType: 'image/jpeg',
    })

    const cutoutBuffer = await callRemoveBg(imageBuffer)

    const processedUrl = await uploadToS3({
      key: `items/${barcode}/${view}-processed.png`,
      body: new Uint8Array(cutoutBuffer),
      contentType: 'image/png',
    })

    item.raw_photo_urls[view as View] = rawUrl
    item.photo_urls[view as View] = processedUrl
    item.needs_photos = item.required_views.some(v => !(v in item!.photo_urls))
    item.updated_at = new Date().toISOString()

    await setItem(item)

    return res.json({ processedUrl, item })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: String(err) })
  }
}
