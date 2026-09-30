import { AwsClient } from 'aws4fetch'
import { createClient } from '@supabase/supabase-js'

// Único endpoint del servidor: las claves de R2 no pueden llegar al navegador.
// POST firma una subida para que el admin mande la imagen ya optimizada directo al bucket;
// DELETE borra imágenes que ninguna pregunta usa.

const KEY = /^questions\/[0-9a-f-]{36}\.webp$/

/** Cliente de Supabase con el token del pedido, o null si no es un admin (RLS de `admins` decide, igual que en el panel). */
async function adminDb(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '')
  if (!token) return null
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  })
  const { data: user } = await db.auth.getUser(token)
  if (!user.user || user.user.is_anonymous) return null
  const { data: admin } = await db.from('admins').select('user_id').maybeSingle()
  return admin ? db : null
}

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
  const { r2, objectUrl } = bucket()
  const key = `questions/${crypto.randomUUID()}.webp`
  const url = objectUrl(key)
  url.searchParams.set('X-Amz-Expires', '300')
  const signed = await r2.sign(new Request(url, { method: 'PUT', headers: { 'content-type': 'image/webp' } }), {
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
  const { data: used, error } = await db.from('questions').select('image_url').in('image_url', candidates)
  if (error) return new Response('db_error', { status: 500 })
  const inUse = new Set(used.map((r) => r.image_url))
  const orphans = candidates.filter((u) => !inUse.has(u))

  const { r2, objectUrl } = bucket()
  await Promise.all(orphans.map((u) => r2.fetch(objectUrl(u.slice(prefix.length)), { method: 'DELETE' })))
  return Response.json({ deleted: orphans.length })
}
