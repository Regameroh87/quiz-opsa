import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

/**
 * Canal de Realtime propio de cada suscripción. supabase.channel(nombre) devuelve el canal existente si ya hay uno
 * con ese nombre, y removeChannel lo cierra en segundo plano: al remontar un efecto (navegar, StrictMode) se
 * reusaría un canal que se está cerrando y dejarían de llegar los avisos. El nombre no afecta a los filtros.
 */
// Math.random y no crypto.randomUUID: este último no existe fuera de HTTPS (p. ej. /play por la IP local en desarrollo).
export const liveChannel = (name: string) => supabase.channel(`${name}:${Math.random().toString(36).slice(2)}`)

/** Header con el token de la sesión, para las rutas de /api (que verifican que sea un admin). */
export async function authHeader() {
  const { data } = await supabase.auth.getSession()
  return { authorization: `Bearer ${data.session?.access_token ?? ''}` }
}

/** Los jugadores entran con sesión anónima; se conserva al recargar. */
export async function ensureSession() {
  const { data } = await supabase.auth.getSession()
  if (!data.session) {
    const { error } = await supabase.auth.signInAnonymously()
    if (error) throw error
  }
}
