import { supabase } from '@/lib/supabase'

// Lado máximo y calidad: nítida en el proyector y liviana para 190 celulares a la vez.
const MAX_SIDE = 1600
const QUALITY = 0.82

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
  const { data } = await supabase.auth.getSession()
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { authorization: `Bearer ${data.session?.access_token ?? ''}` },
  })
  if (!res.ok) throw new Error('sign_failed')
  const { uploadUrl, publicUrl } = (await res.json()) as { uploadUrl: string; publicUrl: string }
  const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'content-type': 'image/webp' }, body })
  if (!put.ok) throw new Error('upload_failed')
  return publicUrl
}
