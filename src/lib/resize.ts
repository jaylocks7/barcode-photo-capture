export function resizeToJpeg(
  source: HTMLCanvasElement,
  maxDimension = 1280,
  quality = 0.85
): Promise<Blob> {
  const scale = Math.min(1, maxDimension / Math.max(source.width, source.height))
  const w = Math.round(source.width * scale)
  const h = Math.round(source.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(source, 0, 0, w, h)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      'image/jpeg',
      quality
    )
  })
}
