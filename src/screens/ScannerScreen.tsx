import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import { getItem } from '../lib/api'
import type { GetItemResponse, ItemRecord } from '../types'

type Props = {
  onScanResult: (barcode: string, result: GetItemResponse) => void
}

const hints = new Map()
hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.UPC_A, BarcodeFormat.UPC_E])

export default function ScannerScreen({ onScanResult }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const lastBarcodeRef = useRef<string | null>(null)
  const handleBarcodeRef = useRef<(barcode: string) => void>(() => {})
  const [loading, setLoading] = useState(false)
  const [manualBarcode, setManualBarcode] = useState('')
  const [completeBanner, setCompleteBanner] = useState<ItemRecord | null>(null)
  const [debugBarcode, setDebugBarcode] = useState<string | null>(null)

  useEffect(() => {
    const reader = new BrowserMultiFormatReader(hints)
    let stopFn: (() => void) | null = null

    reader.decodeFromConstraints(
      { video: { facingMode: 'environment' } },
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

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!manualBarcode.trim()) return
    handleBarcode(manualBarcode.trim())
    setManualBarcode('')
  }

  return (
    <div className="h-dvh bg-black flex flex-col">
      {completeBanner && (
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="font-medium text-gray-900">{completeBanner.name} — already in catalog ✓</span>
            <button
              onClick={() => setCompleteBanner(null)}
              className="text-sm text-blue-600 ml-4"
            >
              Dismiss
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {Object.values(completeBanner.photo_urls).map((url, i) => (
              <img key={i} src={url} className="h-20 w-20 object-contain rounded-lg bg-gray-50" />
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

      <div className="bg-white p-4">
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            type="text"
            placeholder="Enter barcode manually"
            value={manualBarcode}
            onChange={e => setManualBarcode(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-base"
            inputMode="numeric"
          />
          <button
            type="submit"
            disabled={!manualBarcode.trim() || loading}
            className="bg-blue-600 text-white rounded-lg px-4 py-2 font-medium disabled:opacity-50"
          >
            Go
          </button>
        </form>
      </div>
    </div>
  )
}
