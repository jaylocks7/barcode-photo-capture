import { useState } from 'react'
import LoginScreen from './screens/LoginScreen'
import ScannerScreen from './screens/ScannerScreen'
import CaptureScreen from './screens/CaptureScreen'
import SuccessScreen from './screens/SuccessScreen'
import type { ItemRecord } from './types'

type Screen = 'login' | 'scanner' | 'capture' | 'success'

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>(
    sessionStorage.getItem('app_password') ? 'scanner' : 'login'
  )
  const [barcode, setBarcode] = useState<string | null>(null)
  const [item, setItem] = useState<ItemRecord | null>(null)
  const [pendingName, setPendingName] = useState<string | null>(null)
  const [wasNewItem, setWasNewItem] = useState(false)

  function handleLogin() {
    setCurrentScreen('scanner')
  }

  function handleScanResult(scannedBarcode: string, result: { exists: boolean; item?: ItemRecord; suggestion?: { name: string } }) {
    setBarcode(scannedBarcode)
    if (result.exists && result.item) {
      if (result.item.needs_photos) {
        setItem(result.item)
        setPendingName(null)
        setWasNewItem(false)
        setCurrentScreen('capture')
      }
    } else if (!result.exists && result.suggestion) {
      setItem(null)
      setPendingName(result.suggestion.name)
      setWasNewItem(true)
      setCurrentScreen('capture')
    }
  }

  function handlePhotoPosted(updatedItem: ItemRecord) {
    setItem(updatedItem)
    setPendingName(null)
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
    setWasNewItem(false)
    setCurrentScreen('scanner')
  }

  if (currentScreen === 'login') {
    return <LoginScreen onLogin={handleLogin} />
  }
  if (currentScreen === 'scanner') {
    return <ScannerScreen onScanResult={handleScanResult} />
  }
  if (currentScreen === 'capture' && barcode) {
    return (
      <CaptureScreen
        barcode={barcode}
        item={item}
        pendingName={pendingName}
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
