import { AwsClient } from 'aws4fetch'
import { adminDb } from '@/lib/admin-api'

// Las claves de R2 no pueden llegar al navegador.
// POST firma una subida para que el admin mande la imagen ya optimizada directo al bucket;
// DELETE borra imágenes que ninguna pregunta usa.

const KEY = /^questions\/[0-9a-f-]{36}\.(webp|jpg)$/
// WebP en general; JPEG desde Safari, que no codifica WebP en el navegador.
const TYPES: Record<string, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg' }

// Se crea por pedido: sin las variables de R2 el build no debe romperse.
function bucket() {
  const r2 = new AwsClient({
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    service: 's3',
    region: 'auto',
  })
  const objectUrl = (key: string) =>
    new URL(`https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET}/${key}`)
  return { r2, objectUrl }
}

export async function POST(req: Request) {
  if (!(await adminDb(req))) return new Response('forbidden', { status: 403 })
  // Sin las variables de R2 se firmaría contra una URL inválida y el navegador fallaría sin explicación.
  const env = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'NEXT_PUBLIC_R2_PUBLIC_URL']
  if (env.some((name) => !process.env[name])) return new Response('not_configured', { status: 500 })
  // Sin cuerpo (versión anterior del editor): WebP.
  const { type = 'image/webp' } = (await req.json().catch(() => ({}))) as { type?: string }
  if (!Object.hasOwn(TYPES, type)) return new Response('bad_request', { status: 400 })
  const ext = TYPES[type]
  const { r2, objectUrl } = bucket()
  const key = `questions/${crypto.randomUUID()}.${ext}`
  const url = objectUrl(key)
  url.searchParams.set('X-Amz-Expires', '300')
  const signed = await r2.sign(new Request(url, { method: 'PUT', headers: { 'content-type': type } }), {
    aws: { signQuery: true },
  })
  return Response.json({ uploadUrl: signed.url, publicUrl: `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${key}` })
}

export async function DELETE(req: Request) {
  const db = await adminDb(req)
  if (!db) return new Response('forbidden', { status: 403 })
  const { urls } = (await req.json().catch(() => ({}))) as { urls?: unknown }
  if (!Array.isArray(urls)) return new Response('bad_request', { status: 400 })

  // Solo imágenes de preguntas de este bucket.
  const prefix = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/`
  const candidates = urls.filter((u): u is string => typeof u === 'string' && u.startsWith(prefix) && KEY.test(u.slice(prefix.length)))
  if (!candidates.length) return Response.json({ deleted: 0 })

  // Nunca se borra una imagen que alguna pregunta guardada todavía usa: el que llama no tiene que adivinarlo.
  const list = candidates.map((u) => `"${u}"`).join(',')
  const { data: used, error } = await db.from('questions').select('image_url, reveal_image_url')
    .or(`image_url.in.(${list}),reveal_image_url.in.(${list})`)
  if (error) return new Response('db_error', { status: 500 })
  const inUse = new Set(used.flatMap((r) => [r.image_url, r.reveal_image_url]))
  const orphans = candidates.filter((u) => !inUse.has(u))

  const { r2, objectUrl } = bucket()
  await Promise.all(orphans.map((u) => r2.fetch(objectUrl(u.slice(prefix.length)), { method: 'DELETE' })))
  return Response.json({ deleted: orphans.length })
}
