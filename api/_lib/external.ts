export async function lookupExternalProduct(barcode: string): Promise<{ name: string }> {
  try {
    const res = await fetch(
      `https://api.barcodelookup.com/v3/products?barcode=${barcode}&formatted=y&key=${process.env.BARCODE_API_KEY}`
    )
    const data = await res.json() as { products?: { title: string }[] }
    if (data.products?.[0]?.title) {
      return { name: data.products[0].title }
    }
  } catch {
    // fall through to default
  }
  return { name: 'Unknown Item' }
}

export async function callRemoveBg(imageBytes: ArrayBuffer | Buffer): Promise<ArrayBuffer> {
  const form = new FormData()
  form.append('image_file', new Blob([imageBytes], { type: 'image/jpeg' }), 'capture.jpg')
  form.append('size', 'auto')
  form.append('format', 'jpg')
  const res = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: { 'X-Api-Key': process.env.REMOVEBG_API_KEY! },
    body: form,
  })
  if (!res.ok) throw new Error(`remove.bg failed: ${res.status}`)
  return await res.arrayBuffer()
}
