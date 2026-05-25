import type { ItemRecord } from '../types'

type Props = {
  barcode: string
  item: ItemRecord | null
  pendingName: string | null
  onPhotoPosted: (updatedItem: ItemRecord) => void
  onComplete: () => void
}

export default function CaptureScreen(_props: Props) {
  return <div className="p-8 text-gray-500">CaptureScreen — coming soon</div>
}
