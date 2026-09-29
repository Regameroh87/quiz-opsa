'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Logo from '@/components/Logo'

type Status =
  | { status: 'loading' | 'out' }
  | { status: 'forbidden' | 'admin'; email: string }

async function loadStatus(): Promise<Status> {
  const { data } = await supabase.auth.getUser()
  // Las sesiones anónimas (jugadores) no son admins.
  if (!data.user || data.user.is_anonymous) return { status: 'out' }
  const { data: row } = await supabase.from('admins').select('user_id').maybeSingle()
  return { status: row ? 'admin' : 'forbidden', email: data.user.email ?? '' }
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Status>({ status: 'loading' })

  // Se reevalúa con cada cambio de sesión (login, "Cerrar sesión" desde cualquier pantalla, otra pestaña).
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(() => {
      // Fuera del callback: supabase-js no admite otras llamadas de auth dentro de él.
      setTimeout(() => void loadStatus().then(setState), 0)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  if (state.status === 'loading') return <main className="page justify-center text-center"><p className="text-muted">Cargando…</p></main>
  if (state.status === 'out') return <Login />
  if (state.status === 'forbidden') {
    return (
      <main className="page items-center justify-center text-center">
        <Logo height={44} />
        <p className="text-bad">
          {state.email ? <><strong className="break-all">{state.email}</strong> no tiene</> : 'Tu usuario no tiene'} permisos de administrador.
        </p>
        <button className="btn-secondary" onClick={() => void supabase.auth.signOut()}>Entrar con otra cuenta</button>
      </main>
    )
  }
  return children
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    // Si entró, el cambio de sesión lleva solo al panel.
    if (!error) return
    setBusy(false)
    // Sin status es un fallo de red; con status, credenciales rechazadas.
    setError(error.status ? 'Email o contraseña incorrectos.' : 'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.')
  }

  return (
    <main className="page items-center justify-center text-center">
      <Logo height={44} />
      <h1>Admin</h1>
      <form className="card w-full" onSubmit={submit}>
        <label className="text-left">
          Email
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
        </label>
        <label className="text-left">
          Contraseña
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        {/* Espacio reservado: el formulario no salta cuando aparece el error. */}
        <p className="min-h-6 text-bad" role="alert">{error}</p>
        <button className="btn" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </main>
  )
}
