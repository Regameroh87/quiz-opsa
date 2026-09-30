import { supabase } from '@/lib/supabase'

// Lado máximo y calidad: nítida en el proyector y liviana para 190 celulares a la vez.
const MAX_SIDE = 1600
const QUALITY = 0.82

async function authHeader() {
  const { data } = await supabase.auth.getSession()
  return { authorization: `Bearer ${data.session?.access_token ?? ''}` }
}

/** Achica la imagen y la pasa a WebP en el navegador, antes de subirla. */
async function optimize(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', QUALITY))
  if (!blob) throw new Error('encode_failed')
  return blob
}

/** Optimiza y sube la imagen de una pregunta a R2; devuelve su URL pública. */
export async function uploadQuestionImage(file: File): Promise<string> {
  const body = await optimize(file)
  const res = await fetch('/api/upload', { method: 'POST', headers: await authHeader() })
  if (!res.ok) throw new Error('sign_failed')
  const { uploadUrl, publicUrl } = (await res.json()) as { uploadUrl: string; publicUrl: string }
  const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'content-type': 'image/webp' }, body })
  if (!put.ok) throw new Error('upload_failed')
  return publicUrl
}

/**
 * Borra del bucket las imágenes que ya no usa ninguna pregunta guardada (el servidor saltea las que siguen en uso).
 * Es limpieza: si falla, la imagen queda huérfana en R2 pero no se rompe nada, así que no se reporta.
 */
export function deleteQuestionImages(urls: (string | null)[]) {
  const list = urls.filter((u): u is string => !!u)
  if (!list.length) return
  void authHeader()
    .then((headers) => fetch('/api/upload', { method: 'DELETE', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ urls: list }) }))
    .catch(() => {})
}
