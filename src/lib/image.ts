import { authHeader } from '@/lib/supabase'

// Lado máximo y calidad: nítida en el proyector y liviana para 190 celulares a la vez.
const MAX_SIDE = 1600
const QUALITY = 0.82

/**
 * Decodifica la foto. createImageBitmap no lee HEIC/HEIF (el formato de la cámara de iPhone y muchos Android)
 * en todos los navegadores; <img> sí en Safari. Si ninguno puede, el formato no es usable en este navegador.
 */
async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; release: () => void }> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() }
  } catch {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.src = url
    try {
      await img.decode()
    } catch {
      URL.revokeObjectURL(url)
      throw new Error('unsupported_format')
    }
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) }
  }
}

const toBlob = (canvas: HTMLCanvasElement, type: string) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, QUALITY))

/** Achica la imagen y la pasa a WebP en el navegador, antes de subirla (JPEG donde no hay WebP, como Safari). */
async function optimize(file: File): Promise<Blob> {
  const { source, width, height, release } = await decode(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height)
  release()
  // Safari no codifica WebP: devuelve PNG (pesado). Ahí se usa JPEG.
  const webp = await toBlob(canvas, 'image/webp')
  const blob = webp?.type === 'image/webp' ? webp : await toBlob(canvas, 'image/jpeg')
  if (!blob) throw new Error('encode_failed')
  return blob
}

/** Optimiza y sube la imagen de una pregunta a R2; devuelve su URL pública. */
export async function uploadQuestionImage(file: File): Promise<string> {
  const body = await optimize(file)
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { ...(await authHeader()), 'content-type': 'application/json' },
    body: JSON.stringify({ type: body.type }),
  })
  if (!res.ok) throw new Error((await res.text()) === 'not_configured' ? 'not_configured' : 'sign_failed')
  const { uploadUrl, publicUrl } = (await res.json()) as { uploadUrl: string; publicUrl: string }
  const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'content-type': body.type }, body })
  if (!put.ok) throw new Error('upload_failed')
  return publicUrl
}

/** Mensaje para el editor según en qué paso falló la subida. */
export function imageErrorMessage(e: unknown) {
  const code = e instanceof Error ? e.message : ''
  if (code === 'unsupported_format') {
    return 'Este navegador no puede leer ese formato de foto (suele ser HEIC). Probá con una captura de pantalla de la foto, o configurá la cámara en JPG.'
  }
  if (code === 'not_configured') return 'Falta configurar el almacenamiento de imágenes (variables R2_* en Vercel). Avisale al administrador.'
  if (code === 'sign_failed') return 'No tenés permiso para subir imágenes o se cerró tu sesión. Volvé a entrar e intentá de nuevo.'
  return 'No se pudo subir la imagen. Revisá la conexión y probá de nuevo.'
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
