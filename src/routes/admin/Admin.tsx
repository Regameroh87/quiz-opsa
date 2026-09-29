import { useEffect, useState } from 'react'
import { Route, Routes } from 'react-router'
import { supabase } from '../../lib/supabase'
import Logo from '../shared/Logo'
import QuizList from './QuizList'
import QuizEditor from './QuizEditor'

type Status = 'loading' | 'out' | 'forbidden' | 'admin'

export default function Admin() {
  const [status, setStatus] = useState<Status>('loading')

  const check = async () => {
    const { data } = await supabase.auth.getUser()
    // Las sesiones anónimas (jugadores) no son admins.
    if (!data.user || data.user.is_anonymous) return setStatus('out')
    const { data: row } = await supabase.from('admins').select('user_id').maybeSingle()
    setStatus(row ? 'admin' : 'forbidden')
  }
  useEffect(() => { void check() }, [])

  if (status === 'loading') return <main className="page center"><p className="muted">Cargando…</p></main>
  if (status === 'out') return <Login onDone={check} />
  if (status === 'forbidden') {
    return (
      <main className="page center">
        <p className="error">Tu usuario no tiene permisos de administrador.</p>
        <button className="btn secondary" onClick={() => supabase.auth.signOut().then(check)}>Cerrar sesión</button>
      </main>
    )
  }
  return (
    <Routes>
      <Route index element={<QuizList />} />
      <Route path="quiz/:id" element={<QuizEditor />} />
    </Routes>
  )
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
    <main className="page center">
      <Logo height={44} />
      <h1>Admin</h1>
      <form className="card" onSubmit={submit}>
        <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
        <input className="input" type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn">Entrar</button>
      </form>
    </main>
  )
}
