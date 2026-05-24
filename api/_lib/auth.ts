import type { VercelRequest } from '@vercel/node'

export function requireAuth(req: VercelRequest): boolean {
  const provided = req.headers['x-app-password']
return provided === process.env.APP_PASSWORD
}
