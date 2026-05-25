import { useEffect, useRef, useState } from 'react'
import Quagga from '@ericblade/quagga2'
import type { QuaggaJSResultObject } from '@ericblade/quagga2'
import { getItem } from '../lib/api'
import type { GetItemResponse, ItemRecord } from '../types'

type Props = {
  onScanResult: (barcode: string, result: GetItemResponse) => void
}

export default function ScannerScreen({ onScanResult }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const lastBarcodeRef = useRef<string | null>(null)
  const handleBarcodeRef = useRef<(barcode: string) => void>(() => {})
  const [loading, setLoading] = useState(false)
  const [manualBarcode, setManualBarcode] = useState('')
  const [completeBanner, setCompleteBanner] = useState<ItemRecord | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    Quagga.init(
      {
        inputStream: {
          type: 'LiveStream',
          target: containerRef.current,
          constraints: { facingMode: 'environment' },
        },
        decoder: {
          readers: ['ean_reader', 'ean_8_reader', 'upc_reader', 'upc_e_reader'],
        },
        locate: true,
      },
      (err) => {
        if (err) { console.error('Quagga init error:', err); return }
        Quagga.start()
      }
    )

    let consecutive: { code: string; count: number } | null = null

    function onDetected(result: QuaggaJSResultObject) {
      const code = result.codeResult.code
      if (!code) return

      // Reject low-confidence reads
      const errors = result.codeResult.decodedCodes
        .map(x => x.error)
        .filter((e): e is number => e !== undefined)
      if (errors.length > 0) {
        const avgError = errors.reduce((a, b) => a + b, 0) / errors.length
        if (avgError > 0.15) return
      }

      // Require 3 consecutive reads of the same code before firing —
      // false positives from nearby 2D barcodes produce inconsistent values frame-to-frame
      if (consecutive?.code === code) {
        consecutive.count++
      } else {
        consecutive = { code, count: 1 }
      }
      if (consecutive.count < 3) return
      consecutive = null

      if (code === lastBarcodeRef.current) return
      lastBarcodeRef.current = code
      handleBarcodeRef.current(code)
      setTimeout(() => { lastBarcodeRef.current = null }, 3000)
    }

    Quagga.onDetected(onDetected)

    return () => {
      Quagga.offDetected(onDetected)
      Quagga.stop()
    }
  }, [])

  async function handleBarcode(barcode: string) {
    if (loading || completeBanner) return
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

      <div className="relative flex-1 overflow-hidden">
        <style>{`
          .quagga-container video {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .quagga-container canvas { display: none; }
        `}</style>
        <div ref={containerRef} className="quagga-container absolute inset-0" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="text-white text-lg">Looking up…</span>
          </div>
        )}
      </div>

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
