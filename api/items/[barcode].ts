import { requireAuth } from '../_lib/auth'
import { getItem } from '../_lib/storage'
import { lookupExternalProduct } from '../_lib/external'

export const config = { runtime: 'nodejs' }

export default async function handler(req: Request): Promise<Response> {
  const unauthorized = requireAuth(req)
  if (unauthorized) return unauthorized

  const url = new URL(req.url)
  const barcode = url.pathname.split('/').pop()!

  const item = await getItem(barcode)
  if (item) {
    return new Response(JSON.stringify({ exists: true, item }), {
      headers: { 'content-type': 'application/json' },
    })
  }

  const suggestion = await lookupExternalProduct(barcode)
  return new Response(JSON.stringify({ exists: false, suggestion }), {
    headers: { 'content-type': 'application/json' },
  })
}
