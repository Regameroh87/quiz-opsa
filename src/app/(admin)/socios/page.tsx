'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import Logo from '@/components/Logo'
import PageTransition from '@/components/PageTransition'

const ERRORS: Record<string, string> = {
  invalid_email: 'Revisá el email: no parece válido.',
  weak_password: 'La contraseña tiene que tener al menos 8 caracteres.',
  email_taken: 'Ya existe una cuenta con ese email.',
  not_configured: 'Falta configurar la clave de servidor (SUPABASE_SERVICE_ROLE_KEY).',
}

type Access = 'loading' | 'admin' | 'forbidden'

export default function SociosPage() {
  return <PageTransition><Socios /></PageTransition>
}

function Socios() {
  const [access, setAccess] = useState<Access>('loading')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [added, setAdded] = useState('')

  // La página se lo muestra solo a un admin; la que manda es la API, que vuelve a verificar el rol.
  useEffect(() => {
    void supabase.from('admins').select('role').maybeSingle()
      .then(({ data }) => setAccess(data?.role === 'admin' ? 'admin' : 'forbidden'))
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    setAdded('')
    try {
      const { data } = await supabase.auth.getSession()
      const res = await fetch('/api/socios', {
        method: 'POST',
        headers: { authorization: `Bearer ${data.session?.access_token ?? ''}`, 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        setError(ERRORS[await res.text()] ?? 'No se pudo agregar al socio. Intentá de nuevo.')
        return
      }
      setAdded(email.trim().toLowerCase())
      setEmail('')
      setPassword('')
    } catch {
      setError('No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  if (access === 'loading') {
    return (
      <div className="field grid place-items-center">
        <p className="font-display text-4xl text-brand" role="status">Cargando…</p>
      </div>
    )
  }

  return (
    <div className="field">
      <div className="page max-w-xl gap-8 pb-10">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="quiet-link" transitionTypes={['nav-back']}>← Volver a tus quizzes</Link>
          <Logo height={32} />
        </header>

        {access === 'forbidden' ? (
          <section className="sticker-panel flex flex-col gap-3 p-6" role="alert">
            <h1 className="font-display text-[clamp(2rem,5vw,2.8rem)] leading-none text-brand">Sin permisos</h1>
            <p className="text-ink-soft">Solo un administrador puede agregar socios.</p>
          </section>
        ) : (
          <form className="sticker-panel flex flex-col gap-4 p-6" onSubmit={submit} style={{ '--tilt': '-0.6deg' } as React.CSSProperties}>
            <h1 className="font-display text-[clamp(2.2rem,5vw,3.2rem)] leading-none text-brand">Agregar socio</h1>
            <p className="font-bold text-ink-soft">Crea la cuenta para que entre al panel. Solo va a ver y lanzar los quizzes que arme él.</p>
            <label className="sticker-label">
              Email
              <input className="sticker-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" required />
            </label>
            <label className="sticker-label">
              Contraseña inicial
              <input className="sticker-input" type="text" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" minLength={8} required />
            </label>
            <button className="sticker-btn mt-1.5" disabled={busy}>{busy ? 'Agregando…' : 'Agregar socio'}</button>
            <div role="status">
              {added && <p className="font-bold text-white"><strong className="break-all">{added}</strong> ya puede entrar al panel. Pasale la contraseña por un canal privado.</p>}
            </div>
            <div role="alert">{error && <p className="sticker-tag">{error}</p>}</div>
          </form>
        )}
      </div>
    </div>
  )
}
