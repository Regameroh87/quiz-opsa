import { AwsClient } from 'aws4fetch'
import { createClient } from '@supabase/supabase-js'

// Único endpoint del servidor: las claves de R2 no pueden llegar al navegador.
// Devuelve una URL firmada para que el admin suba la imagen ya optimizada directo al bucket.

export async function POST(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '')
  if (!token) return new Response('unauthorized', { status: 401 })

  // Se consulta Supabase con el token del usuario: RLS de `admins` decide igual que en el panel.
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  })
  const { data: user } = await db.auth.getUser(token)
  if (!user.user || user.user.is_anonymous) return new Response('unauthorized', { status: 401 })
  const { data: admin } = await db.from('admins').select('user_id').maybeSingle()
  if (!admin) return new Response('forbidden', { status: 403 })

  // Se crea por pedido: sin las variables de R2 el build no debe romperse.
  const r2 = new AwsClient({
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    service: 's3',
    region: 'auto',
  })
  const key = `questions/${crypto.randomUUID()}.webp`
  const url = new URL(`https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET}/${key}`)
  url.searchParams.set('X-Amz-Expires', '300')
  const signed = await r2.sign(new Request(url, { method: 'PUT', headers: { 'content-type': 'image/webp' } }), {
    aws: { signQuery: true },
  })
  return Response.json({ uploadUrl: signed.url, publicUrl: `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${key}` })
}
