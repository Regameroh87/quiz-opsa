import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { ensureSession } from '../../lib/supabase'
import { errorMessage, rpc, useGame, useQuestion, useRemaining, type Standing } from '../../lib/game'
import { OptionButton } from '../shared/Option'
import Logo from '../shared/Logo'

export default function Play() {
  const [params] = useSearchParams()
  const [code, setCode] = useState((params.get('code') ?? '').toUpperCase())
  const fromQr = (params.get('code') ?? '').length === 6
  const [nickname, setNickname] = useState('')
  const [joined, setJoined] = useState<string | null>(null) // código de la partida ya unida
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Sesión anónima + reconexión: si ya éramos jugadores de esta partida, seguimos.
  useEffect(() => {
    ensureSession()
      .then(async () => {
        const c = (params.get('code') ?? '').toUpperCase()
        if (c) {
          try {
            await rpc('get_my_standing', { p_code: c })
            setJoined(c)
          } catch { /* aún no se unió */ }
        }
      })
      .catch(() => setError('No pudimos conectarnos. Revisá tu conexión.'))
      .finally(() => setReady(true))
  }, [params])

  const join = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await rpc('join_game', { p_code: code, p_nickname: nickname })
      setJoined(code.trim().toUpperCase())
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (!ready) return <main className="page center"><p className="muted">Conectando…</p></main>
  if (joined) return <PlayGame code={joined} />

  return (
    <main className="page center">
      <Logo height={44} />
      <h1>Quiz</h1>
      <form className="card" onSubmit={join}>
        {/* Si se llegó por el QR el código ya viene en la URL: solo se pide el apodo. */}
        {fromQr ? (
          <p className="muted">Partida {code}</p>
        ) : (
          <label>
            Código de la partida
            <input className="input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6} autoCapitalize="characters" autoComplete="off" required />
          </label>
        )}
        <label>
          Tu apodo
          <input className="input" value={nickname} onChange={(e) => setNickname(e.target.value)}
            maxLength={20} autoComplete="off" autoFocus={fromQr} required />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn" disabled={busy || code.length < 6 || !nickname.trim()}>Entrar</button>
      </form>
    </main>
  )
}

function PlayGame({ code }: { code: string }) {
  const { game, error } = useGame({ code })
  const q = useQuestion(game)
  const remaining = useRemaining(q)
  const [standing, setStanding] = useState<Standing | null>(null)
  const [chosen, setChosen] = useState<number | null>(null)
  const [submitError, setSubmitError] = useState('')

  const phase = game?.phase
  const pos = game?.current_position

  const refreshStanding = useCallback(
    () => rpc<Standing>('get_my_standing', { p_code: code }).then(setStanding).catch(() => {}),
    [code],
  )
  useEffect(() => { void refreshStanding() }, [refreshStanding, phase, pos])
  useEffect(() => { setChosen(null); setSubmitError('') }, [pos])

  const answer = async (i: number) => {
    setChosen(i)
    setSubmitError('')
    try {
      await rpc('submit_answer', { p_code: code, p_choice: i })
    } catch (err) {
      setSubmitError(errorMessage(err))
      if (!(err instanceof Error && ['already_answered', 'too_late', 'not_accepting_answers'].includes(err.message))) setChosen(null)
    }
  }

  if (error) return <main className="page center"><p className="error">{errorMessage(error)}</p></main>
  if (!game) return <main className="page center"><p className="muted">Cargando…</p></main>

  const answered = chosen !== null || standing?.answered

  return (
    <main className="page">
      <div className="row">
        <span className="badge grow">{standing?.nickname ?? ''}</span>
        <span className="badge">{standing?.score ?? 0} pts</span>
      </div>

      {phase === 'lobby' && (
        <div className="card center" style={{ textAlign: 'center' }}>
          <h2>¡Estás dentro!</h2>
          <p className="muted">Esperando que empiece el quiz…</p>
        </div>
      )}

      {phase === 'question' && q && (
        <>
          <div className="row">
            <span className="badge grow">Pregunta {q.data.index + 1} de {q.data.total}</span>
            <span className="timer" aria-live="off">{Math.ceil(remaining ?? 0)}</span>
          </div>
          <h2>{q.data.text}</h2>
          {answered ? (
            <div className="card" style={{ textAlign: 'center' }} role="status">
              <h2>¡Respuesta enviada!</h2>
              <p className="muted">Esperá el resultado en la pantalla.</p>
            </div>
          ) : (
            <div className="options">
              {q.data.options.map((o, i) => (
                <OptionButton key={i} index={i} label={o} onClick={() => answer(i)} disabled={(remaining ?? 0) <= 0} />
              ))}
            </div>
          )}
          {submitError && <p className="error" role="alert">{submitError}</p>}
        </>
      )}

      {(phase === 'reveal' || phase === 'leaderboard') && standing && (
        <div className="card" style={{ textAlign: 'center' }} role="status">
          {standing.answered ? (
            <>
              <h2 className={standing.last_correct ? 'result-good' : 'result-bad'}>
                {standing.last_correct ? '¡Correcto!' : 'Incorrecto'}
              </h2>
              <p className="big-score">+{standing.last_points ?? 0}</p>
            </>
          ) : (
            <h2 className="muted">No respondiste a tiempo</h2>
          )}
          <p>Vas en el puesto <strong>#{standing.rank}</strong></p>
        </div>
      )}

      {phase === 'finished' && standing && (
        <div className="card" style={{ textAlign: 'center' }}>
          <h2>¡Fin del quiz!</h2>
          <p className="big-score">#{standing.rank}</p>
          <p>{standing.score} puntos</p>
        </div>
      )}
    </main>
  )
}

