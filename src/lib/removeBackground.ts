import { removeBackground as imglyRemoveBackground } from '@imgly/background-removal'

// Returns a transparent PNG blob with the background removed.
// Model (~40 MB) is downloaded from IMG.LY's CDN on first call and cached by the browser.
export async function removeBackground(image: Blob): Promise<Blob> {
  return imglyRemoveBackground(image)
}

// Triggers model download without processing a real image.
// Call fire-and-forget when the user reaches ScannerScreen so the model is warm by capture time.
export function preloadModel(): void {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  canvas.toBlob(blob => {
    if (blob) imglyRemoveBackground(blob).catch(() => {})
  }, 'image/png')
}
