// Background removal: hybrid Laplacian + color-distance flood fill.
//
// Pure Laplacian flood fill breaks when a single high-contrast edge (e.g. barcode)
// inflates maxLap, pushing the threshold so high that product boundary edges get
// missed and the fill leaks into the product.
//
// Hybrid approach:
//   1. Estimate background color from the four corner regions.
//   2. Use Laplacian edges as a secondary barrier (stops fill even when colors are similar).
//   3. BFS expands only to pixels whose color matches the estimated background.
//
// Works best on plain, low-texture backgrounds (which the capture tip already instructs).

export function removeBackground(source: HTMLCanvasElement): HTMLCanvasElement {
  const w = source.width
  const h = source.height
  const ctx = source.getContext('2d')!
  const { data } = ctx.getImageData(0, 0, w, h)

  // 1. Estimate background color from 15×15 corner regions
  const CORNER = 15
  let sumR = 0, sumG = 0, sumB = 0, count = 0
  for (let y = 0; y < CORNER; y++) {
    for (let x = 0; x < CORNER; x++) {
      for (const [px, py] of [
        [x, y], [w - 1 - x, y], [x, h - 1 - y], [w - 1 - x, h - 1 - y],
      ] as [number, number][]) {
        const i = (py * w + px) * 4
        sumR += data[i]; sumG += data[i + 1]; sumB += data[i + 2]; count++
      }
    }
  }
  const bgR = sumR / count
  const bgG = sumG / count
  const bgB = sumB / count

  // 2. Laplacian edge mask as a secondary fill barrier
  const gray = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) {
    gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]
  }
  let maxLap = 0
  const lapVals = new Float32Array(w * h)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x
      const v = Math.abs(
        gray[idx - w] + gray[idx + w] + gray[idx - 1] + gray[idx + 1] - 4 * gray[idx]
      )
      lapVals[idx] = v
      if (v > maxLap) maxLap = v
    }
  }
  const isEdge = new Uint8Array(w * h)
  const edgeThresh = maxLap * 0.08
  for (let i = 0; i < w * h; i++) {
    isEdge[i] = lapVals[i] > edgeThresh ? 1 : 0
  }

  // Per-channel color match: pixel is background-like if R, G, B are each within T of bgColor.
  // T=50 allows for lighting variation across the background while rejecting product colors.
  const T = 50
  function matchesBg(i: number): boolean {
    return Math.abs(data[i * 4]     - bgR) < T &&
           Math.abs(data[i * 4 + 1] - bgG) < T &&
           Math.abs(data[i * 4 + 2] - bgB) < T
  }

  // 3. BFS flood fill: seed from border pixels that match background color,
  //    expand through background-colored non-edge neighbors
  const isBg = new Uint8Array(w * h)
  const queue: number[] = []

  for (let x = 0; x < w; x++) {
    if (matchesBg(x)) queue.push(x)
    const bot = (h - 1) * w + x
    if (matchesBg(bot)) queue.push(bot)
  }
  for (let y = 1; y < h - 1; y++) {
    const left = y * w
    const right = y * w + w - 1
    if (matchesBg(left)) queue.push(left)
    if (matchesBg(right)) queue.push(right)
  }

  let qi = 0
  while (qi < queue.length) {
    const idx = queue[qi++]
    if (isBg[idx] || isEdge[idx]) continue
    isBg[idx] = 1
    const x = idx % w
    const y = (idx - x) / w
    if (x > 0       && !isBg[idx - 1] && !isEdge[idx - 1] && matchesBg(idx - 1)) queue.push(idx - 1)
    if (x < w - 1   && !isBg[idx + 1] && !isEdge[idx + 1] && matchesBg(idx + 1)) queue.push(idx + 1)
    if (y > 0       && !isBg[idx - w] && !isEdge[idx - w] && matchesBg(idx - w)) queue.push(idx - w)
    if (y < h - 1   && !isBg[idx + w] && !isEdge[idx + w] && matchesBg(idx + w)) queue.push(idx + w)
  }

  // 4. Build output canvas: background → transparent, foreground → opaque
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
