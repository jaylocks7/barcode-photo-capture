import type { GetItemResponse, PostPhotoResponse } from '../types'

function authHeader(): Record<string, string> {
  const password = sessionStorage.getItem('app_password') || ''
  return { 'x-app-password': password }
}

export async function getItem(barcode: string): Promise<GetItemResponse> {
  const res = await fetch(`/api/items/${encodeURIComponent(barcode)}`, {
    headers: authHeader(),
  })
  if (res.status === 401) {
    sessionStorage.removeItem('app_password')
    window.location.reload()
  }
  return res.json()
}

export async function postPhoto(
  barcode: string,
  view: string,
  image: Blob,
  name?: string
): Promise<PostPhotoResponse> {
  const form = new FormData()
  form.append('view', view)
  form.append('image', image, `${view}.jpg`)
  if (name) form.append('name', name)
  const res = await fetch(`/api/items/${encodeURIComponent(barcode)}/photos`, {
    method: 'POST',
    headers: authHeader(),
    body: form,
  })
  return res.json()
}
