'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { QUIZ_LIMIT } from '@/lib/game'
import Logo from '@/components/Logo'
import PageTransition from '@/components/PageTransition'

const ERRORS: Record<string, string> = {
  invalid_email: 'Revisá el email: no parece válido.',
  weak_password: 'La contraseña tiene que tener al menos 8 caracteres.',
  email_taken: 'Ya existe una cuenta con ese email.',
  not_found: 'Esa cuenta ya no existe.',
  not_configured: 'Falta configurar la clave de servidor (SUPABASE_SERVICE_ROLE_KEY).',
}

type Access = 'loading' | 'admin' | 'forbidden'

interface Member { id: string; email: string; role: 'admin' | 'user'; quizzes: number; createdAt: string; lastSignInAt: string | null }
type MembersState = { status: 'loading' | 'error' } | { status: 'ready'; members: Member[] }

const authHeader = async () => {
  const { data } = await supabase.auth.getSession()
  return { authorization: `Bearer ${data.session?.access_token ?? ''}` }
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Nunca'

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
  const [list, setList] = useState<MembersState>({ status: 'loading' })
  const [selfId, setSelfId] = useState('')

  const loadMembers = async () => {
    try {
      const res = await fetch('/api/socios', { headers: await authHeader() })
      if (!res.ok) return setList({ status: 'error' })
      setList({ status: 'ready', members: ((await res.json()) as { members: Member[] }).members })
    } catch {
      setList({ status: 'error' })
    }
  }

  // La página se lo muestra solo a un admin; la que manda es la API, que vuelve a verificar el rol.
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSelfId(data.session?.user.id ?? ''))
    void supabase.from('admins').select('role').maybeSingle()
      .then(({ data }) => {
        const admin = data?.role === 'admin'
        setAccess(admin ? 'admin' : 'forbidden')
        if (admin) void loadMembers()
      })
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    setAdded('')
    try {
      const res = await fetch('/api/socios', {
        method: 'POST',
        headers: { ...(await authHeader()), 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        setError(ERRORS[await res.text()] ?? 'No se pudo agregar al socio. Intentá de nuevo.')
        return
      }
      setAdded(email.trim().toLowerCase())
      setEmail('')
      setPassword('')
      void loadMembers()
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
              {added && <p className="font-bold text-white"><strong className="break-all">{added}</strong> ya puede entrar al panel. Pasale la contraseña por un canal privado; después la puede cambiar desde el panel.</p>}
            </div>
            <div role="alert">{error && <p className="sticker-tag">{error}</p>}</div>
          </form>
        )}

        {access === 'admin' && (
          <section aria-labelledby="members-title" className="flex flex-col gap-3">
            <h2 id="members-title" className="font-display text-[clamp(1.8rem,4vw,2.4rem)] leading-none text-brand">Usuarios del panel</h2>
            {list.status === 'loading' && <p className="text-ink-soft" role="status">Cargando…</p>}
            {list.status === 'error' && (
              <p className="text-ink-soft" role="alert">No se pudo cargar la lista. <button className="quiet-link" onClick={() => { setList({ status: 'loading' }); void loadMembers() }}>Reintentar</button></p>
            )}
            {list.status === 'ready' && (
              <ul className="flex flex-col gap-3">
                {list.members.map((m) => (
                  <MemberRow key={m.id} member={m} isSelf={m.id === selfId} onChanged={loadMembers} />
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  )
}

type Mode = 'view' | 'edit' | 'delete'

/** Una cuenta de la lista, con editar (email, rol, contraseña nueva) y borrar con confirmación. */
function MemberRow({ member: m, isSelf, onChanged }: { member: Member; isSelf: boolean; onChanged: () => Promise<void> }) {
  const [mode, setMode] = useState<Mode>('view')
  const [email, setEmail] = useState(m.email)
  const [role, setRole] = useState(m.role)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const close = () => { setMode('view'); setError(''); setEmail(m.email); setRole(m.role); setPassword('') }

  // PATCH y DELETE comparten el manejo de errores: al terminar bien, se recarga la lista.
  const send = async (method: 'PATCH' | 'DELETE', payload: Record<string, unknown>) => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/socios', {
        method,
        headers: { ...(await authHeader()), 'content-type': 'application/json' },
        body: JSON.stringify({ id: m.id, ...payload }),
      })
      if (!res.ok) return setError(ERRORS[await res.text()] ?? 'No se pudo completar. Intentá de nuevo.')
      await onChanged()
      close()
    } catch {
      setError('No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    void send('PATCH', { email, role, password })
  }

  return (
    <li className="sticker-panel flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <strong className="min-w-0 break-all">{m.email || 'Sin email'}{isSelf && <span className="font-semibold text-ink-soft"> (vos)</span>}</strong>
        <span className="badge shrink-0">{m.role === 'admin' ? 'Admin' : 'Socio'}</span>
      </div>
      <p className="text-sm text-ink-soft">
        {m.role === 'user' ? `${m.quizzes} de ${QUIZ_LIMIT} quizzes` : `${m.quizzes} ${m.quizzes === 1 ? 'quiz' : 'quizzes'}`}
        {' · '}Alta {fmtDate(m.createdAt)}{' · '}Último ingreso {fmtDate(m.lastSignInAt)}
      </p>

      {/* Uno mismo no se edita ni se borra desde acá: la contraseña propia se cambia en /cuenta. */}
      {mode === 'view' && !isSelf && (
        <div className="flex items-center gap-4">
          <button className="quiet-link" onClick={() => setMode('edit')}>Editar</button>
          <button className="quiet-link" onClick={() => setMode('delete')}>Borrar</button>
        </div>
      )}

      {mode === 'edit' && (
        <form className="flex flex-col gap-3 pt-2" onSubmit={save}>
          <label className="sticker-label">
            Email
            <input className="sticker-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" required />
          </label>
          <label className="sticker-label">
            Rol
            <select className="sticker-input" value={role} onChange={(e) => setRole(e.target.value as Member['role'])}>
              <option value="user">Socio: solo ve sus quizzes</option>
              <option value="admin">Admin: ve todo y gestiona socios</option>
            </select>
          </label>
          <label className="sticker-label">
            Contraseña nueva (opcional)
            <input className="sticker-input" type="text" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" minLength={8} placeholder="Dejala vacía para no cambiarla" />
          </label>
          <div className="flex items-center gap-4">
            <button className="sticker-btn sticker-btn-sm" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
            <button type="button" className="quiet-link" onClick={close}>Cancelar</button>
          </div>
        </form>
      )}

      {mode === 'delete' && (
        <div role="alert" className="flex flex-col gap-3 pt-2" onKeyDown={(e) => e.key === 'Escape' && close()}>
          <p>
            ¿Borrar la cuenta de <strong className="break-all">{m.email}</strong>? Ya no va a poder entrar y se borran sus partidas.
            {m.quizzes > 0 && ` Sus ${m.quizzes} ${m.quizzes === 1 ? 'quiz queda' : 'quizzes quedan'} sin dueño: solo los vas a ver vos.`}
          </p>
          <div className="flex items-center gap-4">
            <button className="sticker-btn-danger" disabled={busy} onClick={() => void send('DELETE', {})}>{busy ? 'Borrando…' : 'Borrar'}</button>
            <button className="quiet-link" onClick={close} autoFocus>Cancelar</button>
          </div>
        </div>
      )}

      <div role="alert">{error && <p className="sticker-tag">{error}</p>}</div>
    </li>
  )
}
