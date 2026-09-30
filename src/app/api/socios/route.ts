import { createClient } from '@supabase/supabase-js'

// Alta de socios: crea la cuenta (email + contraseña inicial) y la registra en `admins` con rol 'user'.
// Necesita la clave service_role, que solo vive en el servidor. Solo la puede usar un admin.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD = 8

/** ¿El pedido viene de una sesión con rol admin? (RLS de `admins` deja a cada uno leer solo su fila) */
async function callerIsAdmin(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '')
  if (!token) return false
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  })
  const { data: user } = await db.auth.getUser(token)
  if (!user.user || user.user.is_anonymous) return false
  const { data: row } = await db.from('admins').select('role').maybeSingle()
  return row?.role === 'admin'
}

export async function POST(req: Request) {
  if (!(await callerIsAdmin(req))) return new Response('forbidden', { status: 403 })

  const body = (await req.json().catch(() => ({}))) as { email?: unknown; password?: unknown }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!EMAIL.test(email)) return new Response('invalid_email', { status: 400 })
  if (password.length < MIN_PASSWORD) return new Response('weak_password', { status: 400 })

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return new Response('not_configured', { status: 500 })
  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data.user) {
    return new Response(error?.code === 'email_exists' ? 'email_taken' : 'create_failed', { status: error?.code === 'email_exists' ? 409 : 500 })
  }
  const { error: roleError } = await service.from('admins').insert({ user_id: data.user.id, role: 'user' })
  if (roleError) {
    // Sin la fila en `admins` la cuenta no serviría para nada: no se deja huérfana.
    await service.auth.admin.deleteUser(data.user.id)
    return new Response('create_failed', { status: 500 })
  }
  return Response.json({ email })
}
