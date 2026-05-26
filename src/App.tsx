import { useState } from 'react'
import LoginScreen from './screens/LoginScreen'
import ScannerScreen from './screens/ScannerScreen'
import ItemDetailsScreen from './screens/ItemDetailsScreen'
import CaptureScreen from './screens/CaptureScreen'
import SuccessScreen from './screens/SuccessScreen'
import { patchItem } from './lib/api'
import type { ItemRecord, GetItemResponse } from './types'

type Screen = 'login' | 'scanner' | 'details' | 'capture' | 'success'

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>(
    sessionStorage.getItem('app_password') ? 'scanner' : 'login'
  )
  const [barcode, setBarcode] = useState<string | null>(null)
  const [item, setItem] = useState<ItemRecord | null>(null)
  const [pendingName, setPendingName] = useState<string | null>(null)
  const [pendingPrice, setPendingPrice] = useState<number | null>(null)
  const [wasNewItem, setWasNewItem] = useState(false)
  const [detailsReturnTo, setDetailsReturnTo] = useState<'capture' | 'scanner'>('capture')

  function handleLogin() {
    setCurrentScreen('scanner')
  }

  function handleScanResult(scannedBarcode: string, result: GetItemResponse) {
    setBarcode(scannedBarcode)
    if (result.exists) {
      setItem(result.item)
      setPendingName(null)
      setWasNewItem(false)
    } else {
      setItem(null)
      setPendingName(result.suggestion.name)
      setWasNewItem(true)
    }
    setDetailsReturnTo('capture')
    setCurrentScreen('details')
  }

  function handleEditItem(editItem: ItemRecord) {
    setBarcode(editItem.barcode)
    setItem(editItem)
    setPendingName(null)
    setWasNewItem(false)
    setDetailsReturnTo('scanner')
    setCurrentScreen('details')
  }

  function handleDetailsConfirm(name: string, price: number | null) {
    // Persist immediately if anything changed (or item is new).
    const isNew = !item
    const nameChanged = name !== item?.name
    const priceChanged = price !== (item?.price ?? null)
    if (isNew || nameChanged || priceChanged) {
      const patch: { name: string; price?: number } = { name }
      if (price != null) patch.price = price
      patchItem(barcode!, patch)
        .then(result => { if (result?.item) setItem(result.item) })
        .catch(() => {})
    }

    if (detailsReturnTo === 'scanner') {
      setCurrentScreen('scanner')
      return
    }

    setPendingName(name)
    setPendingPrice(price)
    setCurrentScreen('capture')
  }

  function handlePhotoPosted(updatedItem: ItemRecord) {
    if (!updatedItem) return
    setItem(updatedItem)
    setPendingName(null)
    setPendingPrice(null)
    const missing = updatedItem.required_views.filter(v => !(v in updatedItem.photo_urls))
    if (missing.length === 0) {
      setCurrentScreen('success')
    }
  }

  function handleCaptureComplete() {
    setCurrentScreen('success')
  }

  function handleScanAnother() {
    setBarcode(null)
    setItem(null)
    setPendingName(null)
    setPendingPrice(null)
    setWasNewItem(false)
    setCurrentScreen('scanner')
  }

  if (currentScreen === 'login') {
    return <LoginScreen onLogin={handleLogin} />
  }
  if (currentScreen === 'scanner') {
    return <ScannerScreen onScanResult={handleScanResult} onEditItem={handleEditItem} />
  }
  if (currentScreen === 'details' && barcode) {
    return (
      <ItemDetailsScreen
        barcode={barcode}
        initialName={pendingName ?? item?.name ?? ''}
        initialPrice={item?.price ?? null}
        isNewItem={wasNewItem}
        confirmLabel={detailsReturnTo === 'scanner' ? 'Save' : 'Start Capture'}
        onConfirm={handleDetailsConfirm}
        onCancel={() => {
          if (detailsReturnTo === 'scanner') {
            setCurrentScreen('scanner')
            return
          }
          setBarcode(null)
          setItem(null)
          setPendingName(null)
          setWasNewItem(false)
          setCurrentScreen('scanner')
        }}
      />
    )
  }
  if (currentScreen === 'capture' && barcode) {
    return (
      <CaptureScreen
        barcode={barcode}
        item={item}
        pendingName={pendingName}
        pendingPrice={pendingPrice}
        onPhotoPosted={handlePhotoPosted}
        onComplete={handleCaptureComplete}
      />
    )
  }
  if (currentScreen === 'success' && item) {
    return (
      <SuccessScreen
        item={item}
        wasNewItem={wasNewItem}
        onScanAnother={handleScanAnother}
      />
    )
  }

  return null
}
