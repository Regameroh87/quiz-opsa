'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Logo from '@/components/Logo'
import PwaInstallPrompt from '@/components/PwaInstallPrompt'
import Stage from '@/components/Stage'

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

  if (state.status === 'loading') {
    return (
      <Stage>
        <p className="font-display text-4xl text-brand" role="status">Cargando…</p>
      </Stage>
    )
  }
  if (state.status === 'out') return <Login />
  if (state.status === 'forbidden') {
    return (
      <Stage>
        <Card title="Sin permisos">
          <p className="mb-6 text-ink-soft">
            {state.email ? <><strong className="break-all text-white">{state.email}</strong> no tiene</> : 'Tu usuario no tiene'} permisos de administrador. Pedile acceso a alguien del equipo.
          </p>
          <button className="sticker-btn-ghost" onClick={() => void supabase.auth.signOut()}>Entrar con otra cuenta</button>
        </Card>
      </Stage>
    )
  }
  // Instalar la app solo le sirve al admin (controlar la partida desde el celular):
  // en /play y en el proyector el aviso tapaba la pantalla.
  return <>{children}<PwaInstallPrompt /></>
}

function Card({ title, children, onSubmit }: { title: string; children: React.ReactNode; onSubmit?: (e: React.FormEvent) => void }) {
  const body = (
    <>
      <div className="flex justify-center"><Logo height={38} /></div>
      <h1 className="sticker-title mb-1 mt-3.5">{title}</h1>
      {children}
    </>
  )
  return onSubmit
    ? <form className="sticker-card" onSubmit={onSubmit}>{body}</form>
    : <section className="sticker-card">{body}</section>
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
    <Stage>
      <Card title="¡Armá el quiz!" onSubmit={submit}>
        <p className="mb-[22px] font-bold text-ink-soft">Entrá para crear partidas y llevarlas a la pantalla.</p>
        <div className="flex flex-col gap-3.5">
          <label className="sticker-label">
            Email
            <input className="sticker-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
          </label>
          <label className="sticker-label">
            Contraseña
            <input className="sticker-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </label>
          <button className="sticker-btn mt-1.5" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
        </div>
        {/* El error cuelga del borde de la tarjeta: el formulario no salta cuando aparece. */}
        <div role="alert">{error && <p className="sticker-tag">{error}</p>}</div>
      </Card>
    </Stage>
  )
}
