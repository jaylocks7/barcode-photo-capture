import type { ItemRecord } from '../types'

type Props = {
  item: ItemRecord
  wasNewItem: boolean
  onScanAnother: () => void
}

export default function SuccessScreen(_props: Props) {
  return <div className="p-8 text-gray-500">SuccessScreen — coming soon</div>
}
