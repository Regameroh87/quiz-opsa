'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { errorMessage, rpc, useGame, useHostLive, useQuestion, useRemaining, type Game, type Phase } from '@/lib/game'
import { SHAPES } from '@/components/OptionButton'
import Logo from '@/components/Logo'
import Avatar from '@/components/Avatar'

// "Revelar ahora" no acepta toques en los primeros segundos: un toque de más en "Empezar"/"Siguiente"
// no puede cerrar la pregunta que se acaba de abrir.
const REVEAL_LOCK_S = 2
const URGENT_S = 5
// Clases literales para que Tailwind las detecte.
const OPT_BG = ['bg-opt-0', 'bg-opt-1', 'bg-opt-2', 'bg-opt-3']

// Qué está viendo la sala en cada fase, en palabras del anfitrión.
const SCREEN_NOW: Record<Phase, { title: string; hint: string }> = {
  lobby: { title: 'Sala de espera', hint: 'La pantalla muestra el QR. Los jugadores se suman desde el celular.' },
  question: { title: 'Respondiendo', hint: 'Se revela sola cuando se acaba el tiempo o cuando respondieron todos.' },
  reveal: { title: 'Respuesta', hint: 'La pantalla muestra la respuesta correcta y cuántos eligieron cada opción.' },
  leaderboard: { title: 'Ranking', hint: 'La pantalla muestra los 5 primeros.' },
  finished: { title: 'Podio final', hint: 'La pantalla muestra el podio. La partida terminó.' },
}

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
  const [confirmingFinish, setConfirmingFinish] = useState(false)

  // Cantidad de preguntas desde la sala de espera, para la barra de progreso (la pregunta aún no llegó).
  const quizId = game?.quiz_id
  const [questionCount, setQuestionCount] = useState<number | null>(null)
  useEffect(() => {
    if (!quizId) return
    void supabase.from('questions').select('id', { count: 'exact', head: true }).eq('quiz_id', quizId)
      .then(({ count }) => setQuestionCount(count))
  }, [quizId])

  // Mientras corre un paso, los botones se deshabilitan: un doble toque no debe avanzar dos veces.
  const [advancing, setAdvancing] = useState(false)
  const advance = async (action: string) => {
    setActionError('')
    setConfirmingFinish(false)
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
  const total = q?.data.total ?? questionCount ?? 0
  const current = game.current_position + 1
  const last = current >= total
  const justOpened = !!q && remaining !== null && remaining > q.data.time_limit_s - REVEAL_LOCK_S
  const answeredTotal = stats.reduce((a, b) => a + b, 0)
  const correctCount = q?.data.correct_index != null ? stats[q.data.correct_index] ?? 0 : 0
  const inGame = phase === 'question' || phase === 'reveal' || phase === 'leaderboard'
  const now = SCREEN_NOW[phase]

  const nextLabel = last ? 'Ver podio final' : 'Siguiente pregunta'
  const nextHint = last ? 'Termina el quiz y muestra el podio' : `Muestra la pregunta ${current + 1} de ${total}`

  return (
    <Shell>
      <Progress phase={phase} current={current} total={total} />

      {/* Qué ve la sala ahora mismo. */}
      <section className="sticker-panel flex flex-col gap-4 p-5" aria-labelledby="now-title">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-bold tracking-[0.1em] text-ink-soft uppercase">En la pantalla ahora</p>
          <h1 id="now-title" className="font-display text-3xl leading-none text-brand">{now.title}</h1>
          <p className="text-sm text-ink-soft">{now.hint}</p>
        </div>

        {phase === 'lobby' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Código" value={<span className="tracking-[.08em]">{game.code}</span>} />
              <Stat label={players.length === 1 ? 'Jugador' : 'Jugadores'} value={players.length} />
            </div>
            {players.length > 0 ? (
              <ul className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto" aria-label="Jugadores en la sala">
                {players.map((p) => (
                  <li key={p.nickname} className="flex items-center gap-1.5 rounded-full bg-white py-0.5 pr-3 pl-0.5 text-sm font-bold text-navy">
                    <Avatar id={p.avatar} className="size-7" />{p.nickname}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-2xl border-2 border-dashed border-white/30 px-4 py-3 text-center text-ink-soft">Todavía no se sumó nadie.</p>
            )}
          </>
        )}

        {(phase === 'question' || phase === 'reveal') && !q && <p className="font-bold text-ink-soft" role="status">Cargando pregunta…</p>}

        {phase === 'question' && q && (
          <>
            <div className="flex items-center gap-4">
              <Timer remaining={remaining ?? 0} limit={q.data.time_limit_s} />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <p className="font-bold"><span className="font-display text-2xl tabular-nums">{answered}</span> <span className="text-ink-soft">de {players.length} respondieron</span></p>
                <div className="h-3 overflow-hidden rounded-full bg-white/20" aria-hidden>
                  <div className="h-full rounded-full bg-white motion-safe:transition-[width] motion-safe:duration-300"
                    style={{ width: `${players.length ? Math.min(100, (answered / players.length) * 100) : 0}%` }} />
                </div>
              </div>
            </div>
            <QuestionBlock text={q.data.text} options={q.data.options} />
          </>
        )}

        {phase === 'reveal' && q && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Acertaron" value={<>{correctCount}<span className="text-lg text-ink-soft"> / {players.length}</span></>} />
              <Stat label="Sin responder" value={Math.max(0, players.length - answeredTotal)} />
            </div>
            <QuestionBlock text={q.data.text} options={q.data.options} correct={q.data.correct_index} stats={stats} />
          </>
        )}

        {(phase === 'leaderboard' || phase === 'finished') && (
          <ol className="flex flex-col gap-2">
            {board.map((r) => (
              <li key={r.nickname} className="flex items-center gap-3 rounded-2xl bg-white/10 px-3 py-2">
                <span className={`flex size-8 flex-none items-center justify-center rounded-full font-display ${r.rank === 1 ? 'bg-brand text-brand-contrast' : 'bg-white text-navy'}`}>{r.rank}</span>
                <Avatar id={r.avatar} className="size-9 border-2" />
                <span className="min-w-0 flex-1 truncate font-bold">{r.nickname}</span>
                <span className="font-extrabold tabular-nums">{r.score} <span className="text-xs font-semibold text-ink-soft">pts</span></span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {actionError && <p className="sticker-note" role="alert">{actionError}</p>}

      {/* Próximo paso, pegado abajo: al alcance del pulgar aunque la pregunta sea larga. */}
      <div className="sticky bottom-0 -mx-4 mt-auto flex flex-col gap-3 bg-gradient-to-t from-field from-75% to-transparent px-4 pt-8 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {phase !== 'finished' && <p className="text-xs font-bold tracking-[0.1em] text-ink-soft uppercase">Próximo paso</p>}

        {phase === 'lobby' && (
          <StepButton disabled={players.length === 0 || advancing} onClick={() => advance('start')}
            label={advancing ? 'Empezando…' : 'Empezar el quiz'}
            hint={players.length === 0 ? 'Esperá a que se sume al menos un jugador' : `Muestra la pregunta 1${total ? ` de ${total}` : ''}`} />
        )}
        {phase === 'question' && q && (
          <>
            <p className="rounded-2xl bg-navy/60 px-4 py-3 text-center font-bold" role="status">
              {remaining !== null && remaining > 0 ? 'Esperando respuestas…' : 'Revelando…'}
            </p>
            <StepButton ghost disabled={advancing || justOpened} onClick={() => advance('reveal')}
              label="Revelar ahora" hint="Cierra la pregunta antes de tiempo" />
          </>
        )}
        {(phase === 'reveal' || phase === 'leaderboard') && (
          <StepButton disabled={advancing} onClick={() => advance('next')} label={nextLabel} hint={nextHint} />
        )}
        {phase === 'reveal' && (
          <StepButton ghost disabled={advancing} onClick={() => advance('leaderboard')}
            label="Mostrar ranking" hint="Antes de seguir, muestra los 5 primeros" />
        )}
        {phase === 'finished' && <Link className="sticker-btn" href="/">Volver al panel</Link>}

        {/* Terminar se confirma en el lugar: corta la partida para todos y no se puede reabrir. */}
        {confirmingFinish ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-navy p-3" role="alert"
            onKeyDown={(e) => e.key === 'Escape' && setConfirmingFinish(false)}>
            <p className="min-w-0 flex-1 basis-48 text-sm font-semibold">¿Terminar ahora? La pantalla pasa al podio y no se puede reabrir.</p>
            <button className="sticker-btn-danger" disabled={advancing} onClick={() => advance('finish')}>Terminar</button>
            <button className="quiet-link" onClick={() => setConfirmingFinish(false)} autoFocus>Cancelar</button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-x-4">
            {phase !== 'finished' && (
              <a className="quiet-link" href={`/host/${gameId}`} target="_blank" rel="noreferrer">
                Abrir el proyector<span className="sr-only"> (se abre en otra pestaña)</span>
              </a>
            )}
            {inGame && (
              <button className="quiet-link" disabled={advancing} onClick={() => setConfirmingFinish(true)}>Terminar quiz</button>
            )}
          </div>
        )}
      </div>
    </Shell>
  )
}

/** Dónde está la partida: sala, una barra por pregunta y podio. */
function Progress({ phase, current, total }: { phase: Phase; current: number; total: number }) {
  const label = phase === 'lobby' ? 'Antes de empezar'
    : phase === 'finished' ? 'Partida terminada'
    : `Pregunta ${current} de ${total || '…'}`
  return (
    <div className="flex flex-col gap-2">
      <p className="font-bold">{label}</p>
      {total > 0 && (
        <div className="flex items-center gap-1" aria-hidden>
          {Array.from({ length: total }, (_, i) => {
            const n = i + 1
            const done = phase === 'finished' || (phase !== 'lobby' && n < current)
            const active = !done && phase !== 'lobby' && n === current
            return <span key={i} className={`flex-1 rounded-full ${active ? 'h-3.5 bg-white shadow-[0_0_0_2px_rgb(255_255_255/0.35)]' : done ? 'h-2 bg-white/55' : 'h-2 bg-white/15'}`} />
          })}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/10 px-4 py-3">
      <p className="text-xs font-bold tracking-[0.1em] text-ink-soft uppercase">{label}</p>
      <p className="font-display text-3xl leading-tight">{value}</p>
    </div>
  )
}

/** Tiempo restante como anillo que se vacía; en rojo los últimos segundos. */
function Timer({ remaining, limit }: { remaining: number; limit: number }) {
  const urgent = remaining <= URGENT_S
  const pct = Math.max(0, Math.min(100, (remaining / limit) * 100))
  const seconds = Math.ceil(remaining)
  return (
    <div role="timer" aria-label={`${seconds} segundos`} className="grid size-20 flex-none place-items-center rounded-full p-1.5"
      style={{ background: `conic-gradient(${urgent ? 'var(--color-alert)' : '#fff'} ${pct}%, rgb(255 255 255 / 0.18) 0)` }}>
      <span className={`grid size-full place-items-center rounded-full font-display text-3xl tabular-nums ${urgent ? 'bg-alert text-white' : 'bg-navy text-white'}`}>
        {seconds}
      </span>
    </div>
  )
}

/** La pregunta y sus opciones en formato compacto; al revelar, la correcta y el reparto de votos. */
function QuestionBlock({ text, options, correct, stats }: { text: string; options: string[]; correct?: number | null; stats?: number[] }) {
  const revealed = correct != null && !!stats
  const votes = Math.max(1, stats?.reduce((a, b) => a + b, 0) ?? 0)
  return (
    <div className="flex flex-col gap-3">
      <p className="text-lg leading-snug font-extrabold">{text}</p>
      <ul className="flex flex-col gap-1.5">
        {options.map((o, i) => {
          const isCorrect = revealed && correct === i
          const count = stats?.[i] ?? 0
          return (
            <li key={i} className={`relative flex items-center gap-3 overflow-hidden rounded-xl px-2 py-2 ${isCorrect ? 'bg-white text-navy' : 'bg-white/10'} ${revealed && !isCorrect ? 'opacity-60' : ''}`}>
              {revealed && (
                <span aria-hidden className={`absolute inset-y-0 left-0 ${isCorrect ? 'bg-opt-3/20' : 'bg-white/10'}`} style={{ width: `${(count / votes) * 100}%` }} />
              )}
              <span aria-hidden className={`relative flex size-7 flex-none items-center justify-center rounded-lg text-sm text-white ${OPT_BG[i]}`}>{SHAPES[i]}</span>
              <span className="relative min-w-0 flex-1 font-semibold">{o}</span>
              {isCorrect && <span className="relative text-xs font-black tracking-wide uppercase">Correcta</span>}
              {revealed && <span className="relative w-8 text-right font-black tabular-nums">{count}</span>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Botón de paso con lo que va a pasar escrito abajo, para no adivinar. */
function StepButton({ label, hint, ghost, disabled, onClick }: { label: string; hint: string; ghost?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button className={`${ghost ? 'sticker-btn-ghost' : 'sticker-btn'} flex-col! gap-0.5 py-3!`} disabled={disabled} onClick={onClick}>
      <span>{label}</span>
      <span className="text-[13px] font-semibold opacity-75">{hint}</span>
    </button>
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
