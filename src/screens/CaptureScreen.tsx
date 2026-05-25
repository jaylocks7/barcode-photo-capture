import type { ItemRecord } from '../types'

type Props = {
  barcode: string
  item: ItemRecord | null
  pendingName: string | null
  onPhotoPosted: (updatedItem: ItemRecord) => void
  onComplete: () => void
}

export default function CaptureScreen({ barcode }: Props) {
  return (
    <div className="p-8 text-gray-500">
      <p>CaptureScreen — coming soon</p>
      <p className="mt-2 text-xs font-mono bg-yellow-100 text-yellow-900 px-3 py-2 rounded">
        barcode: {barcode}
      </p>
    </div>
  )
}
