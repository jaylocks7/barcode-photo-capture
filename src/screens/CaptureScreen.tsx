import { useEffect, useRef, useState } from 'react'
import { postPhoto } from '../lib/api'
import { computeLaplacianVariance } from '../lib/blur'
import { resizeCanvas } from '../lib/resize'
import type { ItemRecord, View } from '../types'

type Props = {
  barcode: string
  item: ItemRecord | null
  pendingName: string | null
  pendingPrice: number | null
  isRetakeMode?: boolean
  onPhotoPosted: (updatedItem: ItemRecord) => void
  onComplete: () => void
}

export default function CaptureScreen({ barcode, item, pendingName, pendingPrice, isRetakeMode = false, onPhotoPosted, onComplete }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null)
  const [isBlurry, setIsBlurry] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showTip, setShowTip] = useState(() => !sessionStorage.getItem('capture_tip_shown'))
  const [retakeBlobs, setRetakeBlobs] = useState<Map<View, Blob>>(() => new Map())
  const [retakeViewIndex, setRetakeViewIndex] = useState(0)

  const missingViews: View[] = item
    ? (item.required_views.filter(v => !(v in item.photo_urls)) as View[])
    : ['front']
  const retakeViews: View[] = item?.required_views ?? ['front', 'back']
  const currentView: View = isRetakeMode ? retakeViews[retakeViewIndex] : missingViews[0]
  const itemName = pendingName ?? item?.name ?? 'Unknown Item'
  const displayPrice = pendingPrice ?? item?.price ?? null

  useEffect(() => {
    let active = true
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        if (!active) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
        }
      })
    return () => {
      active = false
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  function retake(blobUrl?: string) {
    const url = blobUrl ?? capturedUrl
    if (url) URL.revokeObjectURL(url)
    setCapturedBlob(null)
    setCapturedUrl(null)
    setIsBlurry(false)
  }

  async function handleShutter() {
    if (!videoRef.current) return
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)

    const variance = computeLaplacianVariance(canvas)
    const resized = resizeCanvas(canvas)
    const blob = await new Promise<Blob>((resolve, reject) =>
      resized.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/jpeg', 0.85)
    )
    const url = URL.createObjectURL(blob)

    setCapturedBlob(blob)
    setCapturedUrl(url)

    if (variance < 300) {
      setIsBlurry(true)
    } else if (isRetakeMode) {
      await handleRetakeCapture(blob, url)
    } else {
      await submitPhoto(blob, url)
    }
  }

  async function handleRetakeCapture(blob: Blob, blobUrl: string) {
    const newBlobs = new Map(retakeBlobs).set(currentView, blob)
    if (retakeViewIndex < retakeViews.length - 1) {
      setRetakeBlobs(newBlobs)
      setRetakeViewIndex(retakeViewIndex + 1)
      retake(blobUrl)
    } else {
      setIsProcessing(true)
      try {
        for (const [view, b] of newBlobs) {
          await postPhoto(barcode, view, b, {})
        }
      } catch {}
      retake(blobUrl)
      setIsProcessing(false)
      onComplete()
    }
  }

  async function submitPhoto(rawBlob: Blob, blobUrl: string) {
    setIsBlurry(false)
    setIsProcessing(true)

    const capturedView = currentView
    const capturedName = pendingName
    const capturedPrice = pendingPrice

    try {
      const result = await postPhoto(barcode, capturedView, rawBlob, { name: capturedName ?? undefined, price: capturedPrice ?? undefined })
      if (result.item) {
        onPhotoPosted(result.item)
      }
    } catch {
      // ignore
    } finally {
      retake(blobUrl)
      setIsProcessing(false)
    }
  }

  if (!currentView) return null

  return (
    <div className="h-dvh bg-black flex flex-col">
      <div className="bg-white px-4 py-3">
        <div className="flex items-baseline gap-2">
          <p className="font-medium text-gray-900 truncate">{itemName}</p>
          {displayPrice != null && (
            <p className="text-sm text-gray-500 shrink-0">${displayPrice.toFixed(2)}</p>
          )}
        </div>
        <p className="text-sm text-gray-500 capitalize">Capturing: {currentView}</p>
      </div>

      <div className="relative flex-1">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
          style={{ display: capturedBlob ? 'none' : 'block' }}
        />
        {capturedUrl && (
          <img
            src={capturedUrl}
            alt="captured"
            className="absolute inset-0 w-full h-full object-contain bg-black"
          />
        )}
        {isBlurry && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 gap-4 p-6">
            <p className="text-white text-lg font-medium text-center">Image may be blurry — please retake</p>
            <button
              onClick={() => retake()}
              className="bg-white text-gray-900 rounded-lg px-5 py-2 font-medium"
            >
              Retake
            </button>
          </div>
        )}
        {showTip && (
          <div className="absolute inset-0 flex items-end bg-black/60 p-5">
            <div className="bg-white rounded-2xl p-5 w-full">
              <p className="font-semibold text-gray-900 mb-3">Tips for a great photo</p>
              <ul className="text-sm text-gray-600 space-y-1 mb-4">
                <li>• Center the item in frame</li>
                <li>• Use a plain, non-busy background</li>
                <li>• Make sure the item is in focus</li>
              </ul>
              <button
                onClick={() => { sessionStorage.setItem('capture_tip_shown', '1'); setShowTip(false) }}
                className="w-full bg-blue-600 text-white rounded-xl py-2.5 font-medium"
              >
                Got it
              </button>
            </div>
          </div>
        )}
        {isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <p className="text-white text-lg">Processing…</p>
          </div>
        )}
      </div>

      {!capturedBlob && !showTip && (
        <div className="bg-black flex justify-center py-6">
          <button
            onClick={handleShutter}
            className="w-16 h-16 rounded-full bg-white border-4 border-gray-300 active:scale-95"
          />
        </div>
      )}
    </div>
  )
}
