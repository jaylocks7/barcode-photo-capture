// Laplacian-based background removal.
//
// Approach: compute Laplacian edge magnitude at each pixel, threshold it into a binary
// edge mask, then BFS flood-fill from every border pixel through non-edge regions to
// label background. Anything the fill reaches becomes transparent; everything else
// (blocked by product edges) stays opaque.
//
// Works best when the product is photographed against a plain, low-texture background
// (which the capture tip overlay already instructs users to do). Struggles with:
//   - backgrounds with strong texture or edges
//   - products that touch the image border
//   - fine detail at product boundaries (hair, thin strands, etc.)

export function removeBackground(source: HTMLCanvasElement): HTMLCanvasElement {
  const w = source.width
  const h = source.height
  const ctx = source.getContext('2d')!
  const { data } = ctx.getImageData(0, 0, w, h)

  // Grayscale
  const gray = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) {
    gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]
  }

  // Laplacian magnitude (4-neighbor discrete second derivative)
  const lap = new Float32Array(w * h)
  let maxLap = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x
      const v = Math.abs(
        gray[idx - w] + gray[idx + w] + gray[idx - 1] + gray[idx + 1] - 4 * gray[idx]
      )
      lap[idx] = v
      if (v > maxLap) maxLap = v
    }
  }

  // Threshold at 15% of peak response to get binary edge mask
  const edgeThreshold = maxLap * 0.15
  const isEdge = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) {
    isEdge[i] = lap[i] > edgeThreshold ? 1 : 0
  }

  // BFS flood fill from all border pixels through non-edge regions → background
  const isBg = new Uint8Array(w * h)
  const queue: number[] = []

  for (let x = 0; x < w; x++) {
    if (!isEdge[x]) queue.push(x)
    if (!isEdge[(h - 1) * w + x]) queue.push((h - 1) * w + x)
  }
  for (let y = 1; y < h - 1; y++) {
    if (!isEdge[y * w]) queue.push(y * w)
    if (!isEdge[y * w + w - 1]) queue.push(y * w + w - 1)
  }

  let qi = 0
  while (qi < queue.length) {
    const idx = queue[qi++]
    if (isBg[idx] || isEdge[idx]) continue
    isBg[idx] = 1
    const x = idx % w
    const y = (idx - x) / w
    if (x > 0 && !isBg[idx - 1] && !isEdge[idx - 1]) queue.push(idx - 1)
    if (x < w - 1 && !isBg[idx + 1] && !isEdge[idx + 1]) queue.push(idx + 1)
    if (y > 0 && !isBg[idx - w] && !isEdge[idx - w]) queue.push(idx - w)
    if (y < h - 1 && !isBg[idx + w] && !isEdge[idx + w]) queue.push(idx + w)
  }

  // Build output canvas: background pixels → transparent, foreground → opaque
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const outCtx = out.getContext('2d')!
  const outData = outCtx.createImageData(w, h)
  const od = outData.data

  for (let i = 0; i < w * h; i++) {
    od[i * 4]     = data[i * 4]
    od[i * 4 + 1] = data[i * 4 + 1]
    od[i * 4 + 2] = data[i * 4 + 2]
    od[i * 4 + 3] = isBg[i] ? 0 : 255
  }

  outCtx.putImageData(outData, 0, 0)
  return out
}

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      'image/png'
    )
  })
}
