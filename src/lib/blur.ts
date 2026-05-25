export function computeLaplacianVariance(source: HTMLCanvasElement): number {
  const maxSize = 256
  const scale = Math.min(1, maxSize / Math.max(source.width, source.height))
  const w = Math.round(source.width * scale)
  const h = Math.round(source.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(source, 0, 0, w, h)

  const { data } = ctx.getImageData(0, 0, w, h)
  const gray = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) {
    gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]
  }

  let sum = 0
  let sumSq = 0
  const count = (w - 2) * (h - 2)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x
      const lap = gray[idx - w] + gray[idx + w] + gray[idx - 1] + gray[idx + 1] - 4 * gray[idx]
      sum += lap
      sumSq += lap * lap
    }
  }
  const mean = sum / count
  return sumSq / count - mean * mean
}
