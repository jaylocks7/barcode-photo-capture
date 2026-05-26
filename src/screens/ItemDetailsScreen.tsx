import { useState } from 'react'

type Props = {
  barcode: string
  initialName: string
  initialPrice: number | null
  isNewItem: boolean
  onConfirm: (name: string, price: number | null) => void
  onCancel: () => void
}

export default function ItemDetailsScreen({ barcode, initialName, initialPrice, isNewItem, onConfirm, onCancel }: Props) {
  const [name, setName] = useState(initialName)
  const [priceStr, setPriceStr] = useState(initialPrice != null ? initialPrice.toFixed(2) : '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = priceStr.trim() !== '' ? parseFloat(priceStr) : null
    onConfirm(name.trim() || initialName, parsed !== null && !isNaN(parsed) ? parsed : null)
  }

  return (
    <div className="h-dvh bg-white flex flex-col">
      <div className="px-4 pt-6 pb-4 border-b border-gray-200">
        <p className="text-xs text-gray-400 font-mono">{barcode}</p>
        <h1 className="text-xl font-semibold text-gray-900 mt-1">
          {isNewItem ? 'New Item' : 'Edit Details'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col p-4 gap-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 select-none">$</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={priceStr}
              onChange={e => setPriceStr(e.target.value)}
              className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-base"
            />
          </div>
        </div>

        <div className="mt-auto flex flex-col gap-3">
          <button
            type="submit"
            disabled={!name.trim()}
            className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold text-base disabled:opacity-50"
          >
            Start Capture
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full text-gray-500 py-2 text-sm"
          >
            Back to Scanner
          </button>
        </div>
      </form>
    </div>
  )
}
