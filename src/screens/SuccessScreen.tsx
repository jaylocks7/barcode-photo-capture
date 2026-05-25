import { useEffect } from 'react'
import type { ItemRecord } from '../types'

type Props = {
  item: ItemRecord
  wasNewItem: boolean
  onScanAnother: () => void
}

export default function SuccessScreen({ item, wasNewItem, onScanAnother }: Props) {
  useEffect(() => {
    const timer = setTimeout(onScanAnother, 2000)
    return () => clearTimeout(timer)
  }, [])

  const message = wasNewItem
    ? `${item.name} — added to catalog ✓`
    : `${item.name} — catalog complete ✓`

  return (
    <div className="h-dvh flex flex-col bg-white">
      <div className="flex-1 overflow-y-auto p-6">
        <h1 className="text-xl font-semibold text-gray-900 mb-6">{message}</h1>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(item.photo_urls).map(([view, url]) => (
            <div key={view}>
              <img
                src={url}
                alt={view}
                crossOrigin="anonymous"
                className="w-full aspect-square object-contain rounded-lg bg-gray-100"
              />
              <p className="text-sm text-gray-500 mt-1 capitalize">{view}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
