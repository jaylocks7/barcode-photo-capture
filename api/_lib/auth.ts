export function requireAuth(req: Request): Response | null {
  const provided = req.headers.get('x-app-password')
  if (provided !== process.env.APP_PASSWORD) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }
  return null
}
