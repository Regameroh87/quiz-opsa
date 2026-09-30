'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ensureSession } from '@/lib/supabase'
import { errorMessage, rpc, useGame, useQuestion, useRemaining, type Standing } from '@/lib/game'
import { OptionButton, OptionGrid } from '@/components/OptionButton'
import Logo from '@/components/Logo'

const connecting = <main className="page justify-center text-center"><p className="text-muted">Conectando…</p></main>

// useSearchParams necesita un límite de Suspense para el prerender.
export default function PlayPage() {
  return <Suspense fallback={connecting}><Play /></Suspense>
}

function Play() {
  const params = useSearchParams()
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

  if (!ready) return connecting
  if (joined) return <PlayGame code={joined} />

  return (
    <main className="page items-center justify-center text-center">
      <Logo height={44} />
      <h1>Quiz</h1>
      <form className="card w-full" onSubmit={join}>
        {/* Si se llegó por el QR el código ya viene en la URL: solo se pide el apodo. */}
        {fromQr ? (
          <p className="text-muted">Partida {code}</p>
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
        {error && <p className="text-bad" role="alert">{error}</p>}
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
  // Elección y error por pregunta: al cambiar de posición se descartan solos.
  const [choice, setChoice] = useState<{ pos: number; index: number | null; error: string } | null>(null)

  const phase = game?.phase
  const pos = game?.current_position
  const current = choice && choice.pos === pos ? choice : null
  const chosen = current?.index ?? null
  const submitError = current?.error ?? ''

  const refreshStanding = useCallback(
    () => rpc<Standing>('get_my_standing', { p_code: code }).then(setStanding).catch(() => {}),
    [code],
  )
  useEffect(() => { void refreshStanding() }, [refreshStanding, phase, pos])

  const answer = async (i: number) => {
    if (pos === undefined) return
    setChoice({ pos, index: i, error: '' })
    try {
      await rpc('submit_answer', { p_code: code, p_choice: i })
    } catch (err) {
      const final = err instanceof Error && ['already_answered', 'too_late', 'not_accepting_answers'].includes(err.message)
      setChoice({ pos, index: final ? i : null, error: errorMessage(err) })
    }
  }

  if (error) return <main className="page justify-center text-center"><p className="text-bad">{errorMessage(error)}</p></main>
  if (!game) return <main className="page justify-center text-center"><p className="text-muted">Cargando…</p></main>

  const answered = chosen !== null || standing?.answered

  return (
    <main className="page">
      <div className="flex flex-wrap items-center gap-2">
        <span className="badge min-w-0 flex-1">{standing?.nickname ?? ''}</span>
        <span className="badge">{standing?.score ?? 0} pts</span>
      </div>

      {phase === 'lobby' && (
        <div className="card justify-center text-center">
          <h2>¡Estás dentro!</h2>
          <p className="text-muted">Esperando que empiece el quiz…</p>
        </div>
      )}

      {phase === 'question' && q && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge min-w-0 flex-1">Pregunta {q.data.index + 1} de {q.data.total}</span>
            <span className="timer" aria-live="off">{Math.ceil(remaining ?? 0)}</span>
          </div>
          <h2>{q.data.text}</h2>
          {q.data.image_url && (
            // eslint-disable-next-line @next/next/no-img-element -- ya viene optimizada desde R2
            <img src={q.data.image_url} alt="" className="mx-auto max-h-[30vh] w-auto rounded-card object-contain" />
          )}
          {answered ? (
            <div className="card text-center" role="status">
              <h2>¡Respuesta enviada!</h2>
              <p className="text-muted">Esperá el resultado en la pantalla.</p>
            </div>
          ) : (
            <OptionGrid>
              {q.data.options.map((o, i) => (
                <OptionButton key={i} index={i} label={o} onClick={() => answer(i)} disabled={(remaining ?? 0) <= 0} />
              ))}
            </OptionGrid>
          )}
          {submitError && <p className="text-bad" role="alert">{submitError}</p>}
        </>
      )}

      {(phase === 'reveal' || phase === 'leaderboard') && standing && (
        <div className="card text-center" role="status">
          {standing.answered ? (
            <>
              <h2 className={standing.last_correct ? 'text-good' : 'text-bad'}>
                {standing.last_correct ? '¡Correcto!' : 'Incorrecto'}
              </h2>
              <p className="text-5xl font-extrabold">+{standing.last_points ?? 0}</p>
            </>
          ) : (
            <h2 className="text-muted">No respondiste a tiempo</h2>
          )}
          <p>Vas en el puesto <strong>#{standing.rank}</strong></p>
        </div>
      )}
      {/* Lo mismo que muestra la pantalla al revelar, por si el proyector no se ve bien. */}
      {phase === 'reveal' && q && (q.data.reveal_image_url || q.data.reveal_text) && (
        <div className="card">
          {q.data.reveal_image_url && (
            // eslint-disable-next-line @next/next/no-img-element -- ya viene optimizada desde R2
            <img src={q.data.reveal_image_url} alt="" className="mx-auto max-h-[35vh] w-auto rounded-card object-contain" />
          )}
          {q.data.reveal_text && <p className="whitespace-pre-line">{q.data.reveal_text}</p>}
        </div>
      )}

      {phase === 'finished' && standing && (
        <div className="card text-center">
          <h2>¡Fin del quiz!</h2>
          <p className="text-5xl font-extrabold">#{standing.rank}</p>
          <p>{standing.score} puntos</p>
        </div>
      )}
    </main>
  )
}
