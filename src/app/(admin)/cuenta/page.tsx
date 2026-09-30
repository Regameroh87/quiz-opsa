'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import Logo from '@/components/Logo'
import PageTransition from '@/components/PageTransition'

const MIN_PASSWORD = 8

// Códigos de error de Supabase Auth.
const ERRORS: Record<string, string> = {
  weak_password: `La contraseña nueva tiene que tener al menos ${MIN_PASSWORD} caracteres.`,
  same_password: 'La contraseña nueva tiene que ser distinta de la actual.',
}

export default function CuentaPage() {
  return <PageTransition><Cuenta /></PageTransition>
}

function Cuenta() {
  const [email, setEmail] = useState('')
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? ''))
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError('')
    setDone(false)
    if (next.length < MIN_PASSWORD) return setError(ERRORS.weak_password)
    if (next !== repeat) return setError('Las contraseñas nuevas no coinciden.')

    setBusy(true)
    try {
      // Se pide la actual: en una notebook compartida, una sesión abierta no alcanza para cambiarla.
      const check = await supabase.auth.signInWithPassword({ email, password: current })
      if (check.error) {
        setError(check.error.status ? 'La contraseña actual no es correcta.' : 'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.')
        return
      }
      const { error: updateError } = await supabase.auth.updateUser({ password: next })
      if (updateError) {
        setError(ERRORS[updateError.code ?? ''] ?? 'No se pudo cambiar la contraseña. Intentá de nuevo.')
        return
      }
      setDone(true)
      setCurrent('')
      setNext('')
      setRepeat('')
    } catch {
      setError('No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="field">
      <div className="page max-w-xl gap-8 pb-10">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="quiet-link" transitionTypes={['nav-back']}>← Volver a tus quizzes</Link>
          <Logo height={32} />
        </header>

        <form className="sticker-panel flex flex-col gap-4 p-6" onSubmit={submit} style={{ '--tilt': '-0.6deg' } as React.CSSProperties}>
          <h1 className="font-display text-[clamp(2.2rem,5vw,3.2rem)] leading-none text-brand">Cambiar contraseña</h1>
          {email && <p className="break-all font-bold text-ink-soft">{email}</p>}
          <label className="sticker-label">
            Contraseña actual
            <input className="sticker-input" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
          </label>
          <label className="sticker-label">
            Contraseña nueva
            <input className="sticker-input" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={MIN_PASSWORD} required />
          </label>
          <label className="sticker-label">
            Repetí la contraseña nueva
            <input className="sticker-input" type="password" value={repeat} onChange={(e) => setRepeat(e.target.value)} autoComplete="new-password" required />
          </label>
          <button className="sticker-btn mt-1.5" disabled={busy}>{busy ? 'Guardando…' : 'Cambiar contraseña'}</button>
          <div role="status">{done && <p className="font-bold text-white">Listo, tu contraseña ya está cambiada.</p>}</div>
          <div role="alert">{error && <p className="sticker-tag">{error}</p>}</div>
        </form>
      </div>
    </div>
  )
}
