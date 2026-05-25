import { useEffect, useRef, useState } from 'react'
import { postPhoto } from '../lib/api'
import { computeLaplacianVariance } from '../lib/blur'
import { resizeToJpeg } from '../lib/resize'
import type { ItemRecord, View } from '../types'

type Props = {
  barcode: string
  item: ItemRecord | null
  pendingName: string | null
  onPhotoPosted: (updatedItem: ItemRecord) => void
  onComplete: () => void
}

export default function CaptureScreen({ barcode, item, pendingName, onPhotoPosted }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null)
  const [isBlurry, setIsBlurry] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const missingViews: View[] = item
    ? (item.required_views.filter(v => !(v in item.photo_urls)) as View[])
    : ['front']
  const currentView = missingViews[0]
  const itemName = item?.name ?? pendingName ?? 'Unknown Item'

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
    const blob = await resizeToJpeg(canvas)
    const url = URL.createObjectURL(blob)

    setCapturedBlob(blob)
    setCapturedUrl(url)

    if (variance < 100) {
      setIsBlurry(true)
    } else {
      await submitPhoto(blob, url)
    }
  }

  async function submitPhoto(blob: Blob, blobUrl: string) {
    setIsBlurry(false)
    setIsProcessing(true)
    try {
      const result = await postPhoto(barcode, currentView, blob, pendingName ?? undefined)
      onPhotoPosted(result.item)
      retake(blobUrl)
    } catch {
      // ignore
    } finally {
      setIsProcessing(false)
    }
  }

  if (!currentView) return null

  return (
    <div className="h-dvh bg-black flex flex-col">
      <div className="bg-white px-4 py-3">
        <p className="font-medium text-gray-900 truncate">{itemName}</p>
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
            <p className="text-white text-lg font-medium text-center">Image may be blurry</p>
            <div className="flex gap-3">
              <button
                onClick={() => retake()}
                className="bg-white text-gray-900 rounded-lg px-5 py-2 font-medium"
              >
                Retake
              </button>
              <button
                onClick={() => { if (capturedBlob && capturedUrl) submitPhoto(capturedBlob, capturedUrl) }}
                className="bg-blue-600 text-white rounded-lg px-5 py-2 font-medium"
              >
                Use Anyway
              </button>
            </div>
          </div>
        )}
        {isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <p className="text-white text-lg">Removing background…</p>
          </div>
        )}
      </div>

      {!capturedBlob && (
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
