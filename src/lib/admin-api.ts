import { createClient } from '@supabase/supabase-js'

/** Cliente de Supabase con el token del pedido, o null si no es un admin (RLS de `admins` decide, igual que en el panel). */
export async function adminDb(req: Request) {
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
