// Background removal: Laplacian edge barrier + adaptive region growing.
//
// Fixed-color flood fill fails on multi-shade backgrounds (hand, wall, shadows) because
// the single corner-sampled average can't represent all background regions.
//
// Adaptive approach: the fill checks each candidate pixel against the color of its
// already-filled neighbor, not a global estimate. This lets it walk through gradual
// color transitions (white wall → shadow → skin tone) as long as each step is locally
// similar. The Laplacian edge barrier still stops it at sharp product boundaries.
//
// T controls per-channel local step tolerance. Lower = stricter (may leave bg patches).
// Higher = looser (may creep into product on gradual edges). Default: 40.

export function removeBackground(source: HTMLCanvasElement, T = 40): HTMLCanvasElement {
  const w = source.width
  const h = source.height
  const ctx = source.getContext('2d')!
  const { data } = ctx.getImageData(0, 0, w, h)

  // 1. Laplacian edge mask — barriers that stop the fill at product boundaries
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

  // 2. Adaptive BFS: seed from all non-edge border pixels, expand to neighbors
  //    whose color is within T of the current (already-filled) pixel's color.
  //    This lets the fill traverse multi-shade backgrounds step by step.
  const isBg = new Uint8Array(w * h)
  const queue: number[] = []

  for (let x = 0; x < w; x++) {
    if (!isEdge[x]) queue.push(x)
    const bot = (h - 1) * w + x
    if (!isEdge[bot]) queue.push(bot)
  }
  for (let y = 1; y < h - 1; y++) {
    const left = y * w
    const right = y * w + w - 1
    if (!isEdge[left]) queue.push(left)
    if (!isEdge[right]) queue.push(right)
  }

  function colorClose(a: number, b: number): boolean {
    return Math.abs(data[a * 4]     - data[b * 4])     < T &&
           Math.abs(data[a * 4 + 1] - data[b * 4 + 1]) < T &&
           Math.abs(data[a * 4 + 2] - data[b * 4 + 2]) < T
  }

  let qi = 0
  while (qi < queue.length) {
    const idx = queue[qi++]
    if (isBg[idx] || isEdge[idx]) continue
    isBg[idx] = 1
    const x = idx % w
    const y = (idx - x) / w
    if (x > 0     && !isBg[idx - 1] && !isEdge[idx - 1] && colorClose(idx, idx - 1)) queue.push(idx - 1)
    if (x < w - 1 && !isBg[idx + 1] && !isEdge[idx + 1] && colorClose(idx, idx + 1)) queue.push(idx + 1)
    if (y > 0     && !isBg[idx - w] && !isEdge[idx - w] && colorClose(idx, idx - w)) queue.push(idx - w)
    if (y < h - 1 && !isBg[idx + w] && !isEdge[idx + w] && colorClose(idx, idx + w)) queue.push(idx + w)
  }

  // 3. Build output canvas: background → transparent, foreground → opaque
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
