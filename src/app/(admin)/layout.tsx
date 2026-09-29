'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Logo from '@/components/Logo'

type Status = 'loading' | 'out' | 'forbidden' | 'admin'

async function loadStatus(): Promise<Status> {
  const { data } = await supabase.auth.getUser()
  // Las sesiones anónimas (jugadores) no son admins.
  if (!data.user || data.user.is_anonymous) return 'out'
  const { data: row } = await supabase.from('admins').select('user_id').maybeSingle()
  return row ? 'admin' : 'forbidden'
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')

  const check = () => loadStatus().then(setStatus)
  useEffect(() => { void check() }, [])

  if (status === 'loading') return <main className="page justify-center text-center"><p className="text-muted">Cargando…</p></main>
  if (status === 'out') return <Login onDone={check} />
  if (status === 'forbidden') {
    return (
      <main className="page justify-center text-center">
        <p className="text-bad">Tu usuario no tiene permisos de administrador.</p>
        <button className="btn-secondary" onClick={() => supabase.auth.signOut().then(check)}>Cerrar sesión</button>
      </main>
    )
  }
  return children
}

function Login({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Email o contraseña incorrectos.')
    else onDone()
  }

  return (
    <main className="page items-center justify-center text-center">
      <Logo height={44} />
      <h1>Admin</h1>
      <form className="card w-full" onSubmit={submit}>
        <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
        <input className="input" type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        {error && <p className="text-bad" role="alert">{error}</p>}
        <button className="btn">Entrar</button>
      </form>
    </main>
  )
}
