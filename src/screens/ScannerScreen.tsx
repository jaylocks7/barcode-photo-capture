import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import { getItem } from '../lib/api'
import type { GetItemResponse, ItemRecord } from '../types'

type Props = {
  onScanResult: (barcode: string, result: GetItemResponse) => void
  onEditItem: (item: ItemRecord) => void
}

const hints = new Map()
hints.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
])
hints.set(DecodeHintType.TRY_HARDER, true)

export default function ScannerScreen({ onScanResult, onEditItem }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const lastBarcodeRef = useRef<string | null>(null)
  const handleBarcodeRef = useRef<(barcode: string) => void>(() => {})
  const [loading, setLoading] = useState(false)
  const [completeBanner, setCompleteBanner] = useState<ItemRecord | null>(null)
  const [debugBarcode, setDebugBarcode] = useState<string | null>(null)

  useEffect(() => {
    const reader = new BrowserMultiFormatReader(hints)
    let stopFn: (() => void) | null = null

    reader.decodeFromConstraints(
      { video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } },
      videoRef.current!,
      (result, _err) => {
        if (!result) return
        const code = result.getText()
        if (code === lastBarcodeRef.current) return
        lastBarcodeRef.current = code
        handleBarcodeRef.current(code)
        setTimeout(() => { lastBarcodeRef.current = null }, 3000)
      }
    ).then(controls => { stopFn = () => controls.stop() })

    return () => { stopFn?.() }
  }, [])

  async function handleBarcode(barcode: string) {
    if (loading || completeBanner) return
    setDebugBarcode(barcode)
    setLoading(true)
    try {
      const result = await getItem(barcode)
      if (result.exists && !result.item.needs_photos) {
        setCompleteBanner(result.item)
      } else {
        onScanResult(barcode, result)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  handleBarcodeRef.current = handleBarcode

  return (
    <div className="h-dvh bg-black flex flex-col">
      {completeBanner && (
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="font-medium text-gray-900">{completeBanner.name}</p>
              <p className="text-sm text-gray-500">
                {completeBanner.price != null ? `$${completeBanner.price.toFixed(2)} · ` : ''}already in catalog ✓
              </p>
            </div>
            <div className="flex gap-3 ml-4 shrink-0">
              <button
                onClick={() => onEditItem(completeBanner)}
                className="text-sm text-blue-600"
              >
                Edit
              </button>
              <button
                onClick={() => setCompleteBanner(null)}
                className="text-sm text-gray-400"
              >
                Dismiss
              </button>
            </div>
          </div>
          <div className="flex gap-3">
            {(['front', 'back'] as const).map(view => (
              <div key={view} className="flex flex-col items-center gap-1">
                {completeBanner.photo_urls[view] ? (
                  <img src={completeBanner.photo_urls[view]} crossOrigin="anonymous" className="h-20 w-20 object-contain rounded-lg bg-gray-50" />
                ) : (
                  <div className="h-20 w-20 rounded-lg bg-gray-100 flex items-center justify-center">
                    <span className="text-xs text-gray-400">—</span>
                  </div>
                )}
                <span className="text-xs text-gray-500 capitalize">{view}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="relative flex-1">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
        />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="text-white text-lg">Looking up…</span>
          </div>
        )}
      </div>

      {debugBarcode && (
        <div className="bg-yellow-100 px-4 py-2 text-xs font-mono text-center text-yellow-900">
          last scan: {debugBarcode}
        </div>
      )}

    </div>
  )
}
