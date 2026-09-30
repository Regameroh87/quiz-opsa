'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { errorMessage, rpc, useGame, useHostLive, useQuestion, useRemaining, type Game, type Phase } from '@/lib/game'
import { SHAPES } from '@/components/OptionButton'
import Logo from '@/components/Logo'
import PageTransition from '@/components/PageTransition'
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
  finished: { title: 'Podio final', hint: 'La pantalla muestra el podio. Lanzá otro quiz o terminá para despedir a los jugadores.' },
}

/**
 * Control de la partida desde el panel: pensado para el celular del anfitrión.
 * La pantalla del proyector (/host) solo muestra; todos los pasos se dan desde acá.
 */
// key: al pasar a la partida siguiente todo arranca de cero.
export default function ControlPage() {
  const { gameId } = useParams<{ gameId: string }>()
  return <PageTransition><Control key={gameId} gameId={gameId} /></PageTransition>
}

function Control({ gameId }: { gameId: string }) {
  const { game, error, setGame } = useGame({ id: gameId })
  const q = useQuestion(game)
  const remaining = useRemaining(q)
  const { players, answered, stats, board } = useHostLive(game, q?.data.id)

  // Si otro dispositivo lanzó el quiz siguiente, este control pasa solo a esa partida (igual que el proyector).
  const router = useRouter()
  const nextGameId = game?.next_game_id
  useEffect(() => {
    if (nextGameId) router.replace(`/control/${nextGameId}`)
  }, [nextGameId, router])
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

  // Terminar desde el podio: no sigue otro quiz, los jugadores pasan a /gracias.
  const [closing, setClosing] = useState(false)
  const close = async () => {
    setActionError('')
    setClosing(true)
    try {
      setGame(await rpc<Game>('close_game', { p_game_id: gameId }))
    } catch (e) {
      setActionError(errorMessage(e))
    } finally {
      setClosing(false)
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
  const closed = !!game.closed_at
  const now = closed
    ? { title: '¡Gracias por jugar!', hint: 'Terminaste el quiz: la pantalla y los celulares muestran el agradecimiento.' }
    : SCREEN_NOW[phase]

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
            {/* El código va a todo el ancho: 6 caracteres grandes no entran en medio celular. */}
            <Stat label="Código para sumarse" value={<span className="tracking-[.1em]">{game.code}</span>} />
            <p className="font-bold" aria-live="polite">
              <span className="font-display text-2xl tabular-nums">{players.length}</span>{' '}
              <span className="text-ink-soft">{players.length === 1 ? 'jugador en la sala' : 'jugadores en la sala'}</span>
            </p>
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
            <p className="font-bold">
              <span className="font-display text-2xl tabular-nums">{correctCount}</span>{' '}
              <span className="text-ink-soft">de {players.length} acertaron</span>
              {players.length > answeredTotal && <span className="text-ink-soft"> · {players.length - answeredTotal} sin responder</span>}
            </p>
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

      {phase === 'finished' && !closed && <NextQuiz game={game} />}

      {actionError && <p className="sticker-note" role="alert">{actionError}</p>}

      {/* Próximo paso, pegado abajo: al alcance del pulgar aunque la pregunta sea larga. En el podio va en el
          flujo: la lista de "¿Otro quiz?" es lo que hay que ver y una barra pegada la taparía. */}
      <div className={`${phase === 'finished' ? '' : 'sticky bottom-0 bg-gradient-to-t from-field from-75% to-transparent pt-8 '}-mx-4 mt-auto flex flex-col gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]`}>
        {!closed && <p className="text-xs font-bold tracking-[0.1em] text-ink-soft uppercase">Próximo paso</p>}

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
        {phase === 'finished' && !closed && (
          <StepButton disabled={closing} onClick={close}
            label={closing ? 'Terminando…' : 'Terminar quiz'} hint="Sin otro quiz: los celulares muestran el agradecimiento" />
        )}
        {phase === 'finished' && (
          <Link className={closed ? 'sticker-btn' : 'quiet-link self-center'} href="/" transitionTypes={['nav-back']}>Volver al panel</Link>
        )}

        {/* Saltar al podio se confirma en el lugar: corta las preguntas que faltan y no se puede reabrir. */}
        {confirmingFinish ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-navy p-3" role="alert"
            onKeyDown={(e) => e.key === 'Escape' && setConfirmingFinish(false)}>
            <p className="min-w-0 flex-1 basis-48 text-sm font-semibold">¿Saltar al podio? Se cortan las preguntas que faltan y no se puede volver atrás.</p>
            <button className="sticker-btn-danger" disabled={advancing} onClick={() => advance('finish')}>Ir al podio</button>
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
              <button className="quiet-link" disabled={advancing} onClick={() => setConfirmingFinish(true)}>Saltar al podio</button>
            )}
          </div>
        )}
      </div>
    </Shell>
  )
}

interface QuizOption { id: string; title: string; questions: { count: number }[] }

/**
 * Desde el podio se lanza otro quiz en el mismo proyector: la partida terminada apunta a la nueva
 * (create_next_game) y la pantalla del proyector la sigue sola. Este celular pasa al control nuevo.
 */
function NextQuiz({ game }: { game: Game }) {
  const router = useRouter()
  const [quizzes, setQuizzes] = useState<QuizOption[] | null>(null)
  const [launching, setLaunching] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    void supabase.from('quizzes').select('id, title, questions(count)').order('created_at', { ascending: false })
      .then(({ data }) => setQuizzes((data ?? []) as QuizOption[]))
  }, [])

  // Ya se lanzó desde otro dispositivo: se sigue a esa en vez de ofrecer otra.
  if (game.next_game_id) {
    return <Link className="sticker-btn" href={`/control/${game.next_game_id}`}>Ir a la partida siguiente</Link>
  }

  const launch = async (quizId: string) => {
    setLaunching(quizId)
    setError('')
    try {
      const next = await rpc<Game>('create_next_game', { p_game_id: game.id, p_quiz_id: quizId })
      // Se mantiene bloqueado hasta que carga el control nuevo, para no lanzar dos.
      router.push(`/control/${next.id}`)
    } catch (e) {
      setError(errorMessage(e))
      setLaunching(null)
    }
  }

  return (
    <section className="sticker-panel flex flex-col gap-4 p-5" aria-labelledby="next-quiz">
      <div className="flex flex-col gap-1">
        <h2 id="next-quiz" className="font-display text-2xl leading-none">¿Otro quiz?</h2>
        <p className="text-sm text-ink-soft">Se lanza en el mismo proyector: la pantalla pasa sola a la sala nueva con su QR.</p>
      </div>
      {quizzes === null && <p className="text-ink-soft" role="status">Cargando quizzes…</p>}
      {quizzes?.length === 0 && <p className="text-ink-soft">No hay quizzes.</p>}
      {quizzes && quizzes.length > 0 && (
        <ul className="flex flex-col gap-2">
          {quizzes.map((q) => {
            const count = q.questions[0]?.count ?? 0
            const titleId = `next-${q.id}`
            return (
              <li key={q.id} className="flex items-center gap-3 rounded-2xl bg-white/10 py-2 pr-2 pl-4">
                <div className="flex min-w-0 flex-1 flex-col">
                  <strong id={titleId} className="truncate">{q.title}</strong>
                  <span className="text-sm text-ink-soft">
                    {count === 0 ? 'Sin preguntas' : `${count} ${count === 1 ? 'pregunta' : 'preguntas'}`}
                    {q.id === game.quiz_id && ' · el que terminó'}
                  </span>
                </div>
                <button className="sticker-btn-ghost sticker-btn-sm shrink-0" disabled={!!launching || count === 0}
                  aria-describedby={titleId} onClick={() => launch(q.id)}>
                  {launching === q.id ? 'Lanzando…' : 'Lanzar'}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {error && <p className="sticker-note" role="alert">{error}</p>}
    </section>
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
    <div className="min-w-0 rounded-2xl bg-white/10 px-4 py-3">
      <p className="truncate text-xs font-bold tracking-[0.1em] text-ink-soft uppercase">{label}</p>
      <p className="truncate font-display text-3xl leading-tight">{value}</p>
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
          <Link className="quiet-link" href="/" transitionTypes={['nav-back']}>← Panel</Link>
          <Logo height={28} />
        </header>
        {children}
      </main>
    </div>
  )
}
