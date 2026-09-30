'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { errorMessage, rpc, useGame, useHostLive, useQuestion, useRemaining, type Game } from '@/lib/game'
import { OptionButton } from '@/components/OptionButton'
import Logo from '@/components/Logo'
import Avatar from '@/components/Avatar'

// "Revelar ya" no acepta toques en los primeros segundos: un toque de más en "Empezar"/"Siguiente"
// no puede cerrar la pregunta que se acaba de abrir.
const REVEAL_LOCK_S = 2
const URGENT_S = 5

/**
 * Control de la partida desde el panel: pensado para el celular del anfitrión.
 * La pantalla del proyector (/host) solo muestra; todos los pasos se dan desde acá.
 */
export default function Control() {
  const { gameId } = useParams<{ gameId: string }>()
  const { game, error, setGame } = useGame({ id: gameId })
  const q = useQuestion(game)
  const remaining = useRemaining(q)
  const { players, answered, stats, board } = useHostLive(game, q?.data.id)
  const [actionError, setActionError] = useState('')

  // Mientras corre un paso, los botones se deshabilitan: un doble toque no debe avanzar dos veces.
  const [advancing, setAdvancing] = useState(false)
  const advance = async (action: string) => {
    setActionError('')
    setAdvancing(true)
    try {
      // Se aplica la respuesta directo, sin esperar el aviso de Realtime.
      setGame(await rpc<Game>('host_advance', { p_game_id: gameId, p_action: action }))
    } catch (e) {
      setActionError(errorMessage(e))
    } finally {
      setAdvancing(false)
    }
  }

  if (error) return <Shell><p className="sticker-note" role="alert">{errorMessage(error)}</p></Shell>
  if (!game) return <Shell><p className="font-display text-3xl text-brand" role="status">Cargando…</p></Shell>

  const phase = game.phase
  const justOpened = !!q && remaining !== null && remaining > q.data.time_limit_s - REVEAL_LOCK_S
  const seconds = Math.ceil(remaining ?? 0)
  const total = Math.max(1, stats.reduce((a, b) => a + b, 0))
  const last = !!q && q.data.index + 1 >= q.data.total
  const inGame = phase === 'question' || phase === 'reveal' || phase === 'leaderboard'

  return (
    <Shell>
      <section className="sticker-panel flex flex-col gap-4 p-5" aria-live="polite">
        {phase === 'lobby' && (
          <>
            <h1 className="font-display text-3xl leading-none text-brand">Sala de espera</h1>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.1em] text-ink-soft">Código</p>
                <p className="font-display text-4xl leading-none tracking-[.1em]">{game.code}</p>
              </div>
              <p className="text-right text-ink-soft"><strong className="block font-display text-4xl leading-none text-white">{players.length}</strong>{players.length === 1 ? 'jugador' : 'jugadores'}</p>
            </div>
            {players.length > 0 && (
              <ul className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                {players.map((p) => (
                  <li key={p.nickname} className="flex items-center gap-1.5 rounded-full bg-white py-0.5 pr-3 pl-0.5 text-sm font-bold text-navy">
                    <Avatar id={p.avatar} className="size-7" />{p.nickname}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {(phase === 'question' || phase === 'reveal') && (q ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <p className="font-bold text-ink-soft">Pregunta {q.data.index + 1} de {q.data.total}</p>
              {phase === 'question'
                ? <span role="timer" aria-label={`${seconds} segundos`}
                    className={`flex size-14 flex-none items-center justify-center rounded-full border-4 border-white font-display text-2xl tabular-nums ${remaining !== null && remaining <= URGENT_S ? 'bg-alert text-white' : 'bg-white text-navy'}`}>
                    {seconds}
                  </span>
                : <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-navy">Respuesta</span>}
            </div>
            <h1 className="text-xl leading-snug font-extrabold">{q.data.text}</h1>
            {phase === 'question' && (
              <div className="flex flex-col gap-1.5">
                <p className="font-bold"><span className="tabular-nums">{answered} / {players.length}</span> respondieron</p>
                <div className="h-2.5 overflow-hidden rounded-full bg-white/20" aria-hidden>
                  <div className="h-full rounded-full bg-white motion-safe:transition-[width]" style={{ width: `${players.length ? (answered / players.length) * 100 : 0}%` }} />
                </div>
              </div>
            )}
            <div className="flex flex-col gap-2">
              {q.data.options.map((o, i) => (
                <OptionButton key={i} index={i} label={o}
                  dim={phase === 'reveal' && q.data.correct_index !== i}
                  correct={phase === 'reveal' && q.data.correct_index === i}
                  count={phase === 'reveal' ? stats[i] ?? 0 : undefined}
                  total={phase === 'reveal' ? total : undefined} />
              ))}
            </div>
            {phase === 'question' && <p className="text-sm text-ink-soft">Se revela sola al terminar el tiempo o cuando respondan todos, si la pantalla del proyector está abierta.</p>}
          </>
        ) : <p className="font-display text-2xl text-brand" role="status">Cargando pregunta…</p>)}

        {(phase === 'leaderboard' || phase === 'finished') && (
          <>
            <h1 className="font-display text-3xl leading-none text-brand">{phase === 'finished' ? 'Podio final' : 'Ranking'}</h1>
            <ol className="flex flex-col gap-2">
              {board.map((r) => (
                <li key={r.nickname} className="flex items-center gap-3 rounded-2xl bg-white/10 px-3 py-2">
                  <span className={`flex size-8 flex-none items-center justify-center rounded-full font-display ${r.rank === 1 ? 'bg-brand text-brand-contrast' : 'bg-white text-navy'}`}>{r.rank}</span>
                  <Avatar id={r.avatar} className="size-9 border-2" />
                  <span className="min-w-0 flex-1 truncate font-bold">{r.nickname}</span>
                  <span className="font-extrabold tabular-nums">{r.score}</span>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>

      {actionError && <p className="sticker-note" role="alert">{actionError}</p>}

      {/* Acciones pegadas abajo: al alcance del pulgar aunque la pregunta sea larga. */}
      <div className="sticky bottom-0 -mx-4 mt-auto flex flex-col gap-3 bg-gradient-to-t from-field from-70% to-transparent px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {phase === 'lobby' && (
          <button className="sticker-btn" disabled={players.length === 0 || advancing} onClick={() => advance('start')}>
            {advancing ? 'Empezando…' : players.length === 0 ? 'Esperando jugadores…' : 'Empezar'}
          </button>
        )}
        {phase === 'question' && q && (
          <button className="sticker-btn" disabled={advancing || justOpened} onClick={() => advance('reveal')}>Revelar ya</button>
        )}
        {phase === 'reveal' && q && (
          <>
            <button className="sticker-btn" disabled={advancing} onClick={() => advance('next')}>
              {last ? 'Ver resultado final' : 'Siguiente pregunta'}
            </button>
            <button className="sticker-btn-ghost" disabled={advancing} onClick={() => advance('leaderboard')}>Ver ranking</button>
          </>
        )}
        {phase === 'leaderboard' && (
          <button className="sticker-btn" disabled={advancing} onClick={() => advance('next')}>
            {last ? 'Ver resultado final' : 'Siguiente pregunta'}
          </button>
        )}
        {phase === 'finished' && <Link className="sticker-btn" href="/">Volver al panel</Link>}

        <div className="flex flex-wrap items-center justify-between gap-x-4">
          {phase !== 'finished' && (
            <a className="quiet-link" href={`/host/${gameId}`} target="_blank" rel="noreferrer">
              Abrir pantalla del proyector<span className="sr-only"> (se abre en otra pestaña)</span>
            </a>
          )}
          {inGame && (
            <button className="quiet-link" disabled={advancing} onClick={() => confirm('¿Terminar el quiz ahora? Los jugadores ven su puesto final.') && advance('finish')}>
              Terminar quiz
            </button>
          )}
        </div>
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="field">
      <main className="page gap-5">
        <header className="flex items-center justify-between gap-4">
          <Link className="quiet-link" href="/">← Panel</Link>
          <Logo height={28} />
        </header>
        {children}
      </main>
    </div>
  )
}
