import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, DecodeHintType } from '@zxing/browser'
import { BarcodeFormat } from '@zxing/library'

type Props = {
  onScanResult: (barcode: string, result: unknown) => void
}

const hints = new Map()
hints.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
])

export default function ScannerScreen({ onScanResult: _onScanResult }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const lastBarcodeRef = useRef<string | null>(null)
  const [lastScanned, setLastScanned] = useState<string | null>(null)
  const [manualBarcode, setManualBarcode] = useState('')

  useEffect(() => {
    const reader = new BrowserMultiFormatReader(hints)
    readerRef.current = reader

    reader.decodeFromConstraints(
      { video: { facingMode: 'environment' } },
      videoRef.current!,
      (result, err) => {
        if (!result) return
        const text = result.getText()
        if (text === lastBarcodeRef.current) return
        lastBarcodeRef.current = text
        console.log('scanned:', text)
        setLastScanned(text)
        setTimeout(() => { lastBarcodeRef.current = null }, 3000)
      }
    )

    return () => { reader.reset() }
  }, [])

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!manualBarcode.trim()) return
    console.log('manual:', manualBarcode.trim())
    setLastScanned(manualBarcode.trim())
    setManualBarcode('')
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <div className="relative flex-1">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
        />
        {lastScanned && (
          <div className="absolute top-4 left-4 right-4 bg-green-500 text-white rounded-xl px-4 py-3 text-center font-mono text-lg font-bold">
            {lastScanned}
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
            disabled={!manualBarcode.trim()}
            className="bg-blue-600 text-white rounded-lg px-4 py-2 font-medium disabled:opacity-50"
          >
            Go
          </button>
        </form>
      </div>
    </div>
  )
}
