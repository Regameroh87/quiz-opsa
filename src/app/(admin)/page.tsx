'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { errorMessage, rpc, type Game, type Phase } from '@/lib/game'
import Logo from '@/components/Logo'

interface Quiz { id: string; title: string; created_at: string; questions: { count: number }[] }

type ListState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; quizzes: Quiz[] }

async function fetchQuizzes(): Promise<ListState> {
  const { data, error } = await supabase.from('quizzes').select('id, title, created_at, questions(count)').order('created_at', { ascending: false })
  return error ? { status: 'error' } : { status: 'ready', quizzes: data }
}

interface LiveGame {
  id: string
  code: string
  phase: Exclude<Phase, 'finished'>
  current_position: number
  quizzes: { title: string; questions: { count: number }[] } | null
}

type LiveState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; games: LiveGame[] }

// Las partidas no se cierran solas: una sala abandonada quedaría "en curso" para siempre.
// Solo se ofrecen las del mismo día de evento.
const LIVE_WINDOW_MS = 12 * 60 * 60 * 1000

async function fetchLiveGames(): Promise<LiveState> {
  const { data: auth } = await supabase.auth.getSession()
  const userId = auth.session?.user.id
  if (!userId) return { status: 'ready', games: [] }
  const { data, error } = await supabase.from('games')
    .select('id, code, phase, current_position, quizzes(title, questions(count))')
    .eq('host_id', userId)
    .neq('phase', 'finished')
    .gte('created_at', new Date(Date.now() - LIVE_WINDOW_MS).toISOString())
    .order('created_at', { ascending: false })
  return error ? { status: 'error' } : { status: 'ready', games: data as unknown as LiveGame[] }
}

function phaseLabel(g: LiveGame) {
  if (g.phase === 'lobby') return `En sala de espera · código ${g.code}`
  const total = g.quizzes?.questions[0]?.count
  const n = `Pregunta ${g.current_position + 1}${total ? ` de ${total}` : ''}`
  return g.phase === 'leaderboard' ? `${n} · mostrando ranking` : n
}

/** Partidas propias sin terminar: el camino de vuelta a la sala si se cerró la pestaña del host. */
function LiveGames({ live, onRetry }: { live: LiveState; onRetry: () => void }) {
  if (live.status === 'loading') return null
  if (live.status === 'error') {
    return (
      <p className="text-muted" role="status">
        No pudimos ver si tenés partidas en curso.{' '}
        <button className="font-semibold text-text underline underline-offset-4"
          onClick={onRetry}>
          Reintentar
        </button>
      </p>
    )
  }
  if (live.games.length === 0) return null

  return (
    <section aria-labelledby="live-heading" className="flex flex-col gap-3">
      <h2 id="live-heading" className="text-[1.25rem]">
        {live.games.length === 1 ? 'Partida en curso' : 'Partidas en curso'}
      </h2>
      <ul className="flex flex-col gap-3">
        {live.games.map((g) => (
          <li key={g.id} className="flex flex-col gap-3 rounded-card border-2 border-brand bg-surface p-5 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <strong id={`live-${g.id}`} className="text-[1.125rem] break-words">{g.quizzes?.title ?? 'Quiz'}</strong>
              <span className="text-muted">{phaseLabel(g)}</span>
            </div>
            <Link className="btn shrink-0" href={`/host/${g.id}`} aria-describedby={`live-${g.id}`}>Volver a la sala</Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Quién está logueado en la notebook compartida, y cómo salir. */
function Account({ liveCount }: { liveCount: number }) {
  const [email, setEmail] = useState('')
  const [confirming, setConfirming] = useState(false)
  // Al cancelar, el foco vuelve a "Cerrar sesión" en vez de perderse en <body>.
  const [cancelled, setCancelled] = useState(false)
  const cancel = () => { setConfirming(false); setCancelled(true) }
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? ''))
  }, [])

  // Scope local: cierra solo esta notebook, no las sesiones del admin en otros equipos.
  const signOut = () => void supabase.auth.signOut({ scope: 'local' })

  if (confirming) {
    return (
      // Keys distintas: cada variante monta sus propios botones, así autoFocus aplica al volver.
      <div key="confirm" className="flex flex-wrap items-center gap-x-4 gap-y-2" role="alert" onKeyDown={(e) => e.key === 'Escape' && cancel()}>
        <span>{liveCount === 1 ? 'Tenés una partida en curso' : 'Tenés partidas en curso'}: si salís, la pantalla de la sala deja de responder.</span>
        <button className={DANGER} onClick={signOut}>Salir igual</button>
        <button className={QUIET} onClick={cancel} autoFocus>Cancelar</button>
      </div>
    )
  }
  return (
    <div key="account" className="flex min-w-0 items-center gap-3">
      <span className="min-w-0 truncate text-muted" title={email}>{email}</span>
      {/* Salir con una partida abierta corta la pantalla del host: se confirma primero. */}
      <button className={`${QUIET} shrink-0`} autoFocus={cancelled} onClick={() => (liveCount > 0 ? setConfirming(true) : signOut())}>Cerrar sesión</button>
    </div>
  )
}

const questionCount = (q: Quiz) => q.questions[0]?.count ?? 0

const dayMonth = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' })
const dayMonthYear = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })

/** "6 preguntas · creado 20 sept." — lo necesario para saber si el quiz está listo para lanzar. */
function quizMeta(q: Quiz) {
  const n = questionCount(q)
  const date = new Date(q.created_at)
  const fmt = date.getFullYear() === new Date().getFullYear() ? dayMonth : dayMonthYear
  return `${n} ${n === 1 ? 'pregunta' : 'preguntas'} · creado ${fmt.format(date)}`
}

// Referencia estable: enfoca solo al aparecer, no en cada render.
const focusOnMount = (el: HTMLElement | null) => el?.focus()

// Acción en curso sobre un quiz: mientras dura, se bloquean todas las acciones de la lista.
type Busy = { quizId: string; action: 'launch' | 'remove' } | null

// Acciones secundarias de cada fila: discretas, para que "Lanzar en vivo" sea lo único que resalte.
const QUIET = 'inline-flex min-h-11 items-center px-1 font-semibold text-muted underline-offset-4 hover:text-text hover:underline'
const DANGER = 'min-h-11 rounded-[10px] bg-bad px-4 font-bold text-brand-contrast'

export default function QuizList() {
  const [list, setList] = useState<ListState>({ status: 'loading' })
  const [busy, setBusy] = useState<Busy>(null)
  // El error se muestra en la tarjeta del quiz que falló, no arriba de todo.
  // fixHref: cuando el error se arregla editando el quiz, se ofrece el camino directo.
  const [cardError, setCardError] = useState<{ quizId: string; message: string; fixHref?: string } | null>(null)
  // Quiz cuya fila muestra la confirmación de borrado.
  const [confirming, setConfirming] = useState<string | null>(null)
  // Fila cuya confirmación se canceló: su "Borrar" recupera el foco.
  const [cancelledRemove, setCancelledRemove] = useState<string | null>(null)
  const cancelRemove = () => {
    setCancelledRemove(confirming)
    setConfirming(null)
  }
  const router = useRouter()

  const [live, setLive] = useState<LiveState>({ status: 'loading' })

  const load = () => fetchQuizzes().then(setList)
  useEffect(() => {
    void fetchQuizzes().then(setList)
    void fetchLiveGames().then(setLive)
  }, [])

  const retryLive = () => {
    setLive({ status: 'loading' })
    void fetchLiveGames().then(setLive)
  }

  const retry = () => {
    setList({ status: 'loading' })
    void load()
  }

  const launch = async (quizId: string) => {
    if (busy) return
    setBusy({ quizId, action: 'launch' })
    setConfirming(null)
    setCardError(null)
    try {
      const game = await rpc<Game>('create_game', { p_quiz_id: quizId })
      // Se mantiene bloqueado hasta que carga la pantalla del host, para no crear otra partida.
      router.push(`/host/${game.id}`)
    } catch (e) {
      // Otro admin pudo haberle quitado las preguntas desde que se cargó la lista.
      const empty = e instanceof Error && e.message === 'quiz_empty'
      setCardError({ quizId, message: errorMessage(e), fixHref: empty ? `/quiz/${quizId}` : undefined })
      setBusy(null)
      if (empty) void load()
    }
  }

  const askRemove = (quizId: string) => {
    setCardError(null)
    setConfirming(quizId)
  }

  const remove = async (q: Quiz) => {
    if (busy) return
    setConfirming(null)
    setBusy({ quizId: q.id, action: 'remove' })
    const { error } = await supabase.from('quizzes').delete().eq('id', q.id)
    setBusy(null)
    if (!error) return void load()
    // games.quiz_id es on delete restrict: un quiz ya jugado no se puede borrar (23503 = foreign_key_violation).
    setCardError({
      quizId: q.id,
      message: error.code === '23503'
        ? 'No se puede borrar un quiz que ya se usó en una partida.'
        : 'No se pudo borrar. Revisá tu conexión e intentá de nuevo.',
    })
  }

  return (
    <main className="page max-w-3xl gap-6">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Logo height={36} />
        <Link className="btn-secondary ml-auto px-4 py-2.5 sm:order-last sm:ml-0" href="/quiz/new">Nuevo quiz</Link>
        {/* En el celular la cuenta baja a su propia línea; en pantallas anchas va junto a "Nuevo quiz". */}
        <div className="w-full min-w-0 sm:ml-auto sm:w-auto">
          <Account liveCount={live.status === 'ready' ? live.games.length : 0} />
        </div>
      </header>

      {/* El título de la página va primero para lectores de pantalla; la franja de partidas se ve antes. */}
      <h1 className="sr-only">Panel de quizzes</h1>

      <LiveGames live={live} onRetry={retryLive} />

      <div className="flex flex-col gap-1">
        <h2 className="text-[2em]">Quizzes</h2>
        {/* La notebook a veces se duplica en el proyector: que nadie se sorprenda al lanzar. */}
        {list.status === 'ready' && list.quizzes.length > 0 && <p className="text-muted">Al lanzar, esta pantalla pasa a la sala de espera con el código QR para que se sumen los jugadores.</p>}
      </div>

      {list.status === 'loading' && <p className="text-muted" role="status">Cargando quizzes…</p>}

      {list.status === 'error' && (
        <div className="card items-start" role="alert">
          <p className="text-bad">No pudimos cargar los quizzes. Revisá tu conexión.</p>
          <button className="btn-secondary" onClick={retry}>Reintentar</button>
        </div>
      )}

      {list.status === 'ready' && list.quizzes.length === 0 && (
        <div className="card items-start">
          <p>Todavía no hay quizzes.</p>
          <Link className="btn" href="/quiz/new">Crear el primer quiz</Link>
        </div>
      )}

      {list.status === 'ready' && list.quizzes.length > 0 && (
        <ul className="flex flex-col gap-2">
          {list.quizzes.map((q) => {
            const launching = busy?.quizId === q.id && busy.action === 'launch'
            const removing = busy?.quizId === q.id && busy.action === 'remove'
            const titleId = `quiz-${q.id}`
            const metaId = `quiz-meta-${q.id}`
            const empty = questionCount(q) === 0
            return (
              <li key={q.id} className="flex flex-col gap-3 rounded-card bg-surface p-5 sm:flex-row sm:items-center sm:gap-6" aria-busy={launching || removing}>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <strong id={titleId} className="text-[1.125rem] break-words">{q.title}</strong>
                  {empty ? (
                    <p id={metaId} className="text-muted">
                      Sin preguntas todavía.{' '}
                      <Link className="font-semibold text-brand underline underline-offset-4" href={`/quiz/${q.id}`}>Agregá preguntas</Link>
                    </p>
                  ) : (
                    <p id={metaId} className="text-muted">{quizMeta(q)}</p>
                  )}
                  {confirming === q.id ? (
                    <div key="confirm" className="flex flex-wrap items-center gap-x-4 gap-y-2"
                      onKeyDown={(e) => e.key === 'Escape' && cancelRemove()}>
                      <span>
                        ¿Borrar este quiz<span className="sr-only"> «{q.title}»</span> y sus preguntas? No se puede deshacer.
                      </span>
                      <button className={DANGER} onClick={() => remove(q)} aria-describedby={titleId}>Borrar quiz</button>
                      <button className={QUIET} onClick={cancelRemove} autoFocus>Cancelar</button>
                    </div>
                  ) : (
                    <div key="actions" className="-ml-1 flex gap-4">
                      <Link className={`${QUIET} ${busy ? 'pointer-events-none opacity-50' : ''}`}
                        href={`/quiz/${q.id}`} aria-describedby={titleId} aria-disabled={!!busy} tabIndex={busy ? -1 : undefined}>
                        Editar
                      </Link>
                      <button className={`${QUIET} hover:text-bad`} disabled={!!busy} aria-describedby={titleId}
                        autoFocus={cancelledRemove === q.id} onClick={() => askRemove(q.id)}>
                        {removing ? 'Borrando…' : 'Borrar'}
                      </button>
                    </div>
                  )}
                  {cardError?.quizId === q.id && (
                    // Recibe el foco: el botón que lo disparó queda deshabilitado mientras corre la acción.
                    <p className="text-bad" role="alert" tabIndex={-1} ref={focusOnMount}>
                      {cardError.message}{' '}
                      {cardError.fixHref && (
                        <Link className="font-semibold text-text underline underline-offset-4" href={cardError.fixHref}>Editar quiz</Link>
                      )}
                    </p>
                  )}
                </div>
                <button className="btn-outline shrink-0" disabled={!!busy || empty} aria-describedby={`${titleId} ${metaId}`} onClick={() => launch(q.id)}>
                  {launching ? 'Abriendo sala…' : 'Lanzar en vivo'}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
