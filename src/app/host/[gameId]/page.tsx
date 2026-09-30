'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import QRCode from 'qrcode'
import { supabase } from '@/lib/supabase'
import { errorMessage, rpc, useGame, useLatest, useQuestion, useRemaining, type Game, type LeaderRow } from '@/lib/game'
import { OptionButton, OptionGrid } from '@/components/OptionButton'
import Logo from '@/components/Logo'

// Pantalla del proyector: todo escala en em a partir del font-size base.
// Mundo calcomanía: campo azul con las piezas pegadas encima como stickers.
const SCREEN = 'field flex flex-col gap-[1.4em] p-[3vw] text-[clamp(16px,1.6vw,28px)]'
const TITLE = 'font-display text-[3.4em] leading-[0.95] text-brand [text-wrap:balance]'
const BTN = 'w-auto! px-[1.6em]! py-[0.6em]! text-[1.1em]!'
const ACTIONS = 'mt-auto flex items-center justify-end gap-[1em]'
const REVEAL_LOCK_S = 2
const URGENT_S = 5
// Chip-sticker con troquel blanco para los datos de estado, arriba a la derecha.
const CHIP = 'rounded-full border-[0.15em] border-white bg-navy px-[0.9em] py-[0.35em] font-bold whitespace-nowrap'
// Podio: 2.º, 1.º, 3.º de izquierda a derecha; el primero más alto y en amarillo.
const PODIUM = [
  { height: 'min-h-[13em]', fill: 'bg-brand text-brand-contrast', delay: 700 },
  { height: 'min-h-[9.5em]', fill: 'bg-white text-navy', delay: 400 },
  { height: 'min-h-[7em]', fill: 'bg-white text-navy', delay: 100 },
]

export default function Host() {
  const { gameId } = useParams<{ gameId: string }>()
  const { game, error, setGame } = useGame({ id: gameId })
  const q = useQuestion(game)
  const remaining = useRemaining(q)
  const [players, setPlayers] = useState<string[]>([])
  // Respuestas contadas por pregunta, para que el conteo de la anterior no se arrastre a la nueva.
  const [answeredFor, setAnsweredFor] = useState<{ questionId: string; n: number } | null>(null)
  const [stats, setStats] = useState<number[]>([])
  const [board, setBoard] = useState<LeaderRow[]>([])
  const [actionError, setActionError] = useState('')
  const autoRevealed = useRef<number | null>(null)

  const phase = game?.phase
  const pos = game?.current_position
  const playerCount = useLatest(players.length)
  const questionId = q?.data.id
  const currentQuestionId = useLatest(questionId)
  const answered = answeredFor && answeredFor.questionId === questionId ? answeredFor.n : 0

  // Mientras corre un paso, los botones de avance se deshabilitan: un doble clic no debe avanzar dos veces.
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
  // "Revelar ya" no acepta clics en los primeros segundos: un clic de más en "Empezar"/"Siguiente"
  // no puede cerrar la pregunta que se acaba de abrir.
  const justOpened = !!q && remaining !== null && remaining > q.data.time_limit_s - REVEAL_LOCK_S

  // Jugadores en vivo
  useEffect(() => {
    const load = () =>
      supabase.from('players').select('nickname').eq('game_id', gameId).order('created_at')
        .then(({ data }) => setPlayers((data ?? []).map((p) => p.nickname)))
    const ch = supabase.channel(`players-${gameId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'players', filter: `game_id=eq.${gameId}` },
        (p) => setPlayers((prev) => [...prev, (p.new as { nickname: string }).nickname]))
      .subscribe((s) => s === 'SUBSCRIBED' && load())
    return () => { void supabase.removeChannel(ch) }
  }, [gameId])

  // Respuestas en vivo: se cuentan inserts y se recarga la distribución al recibirlas o al cambiar de fase.
  useEffect(() => {
    const ch = supabase.channel(`answers-${gameId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'answers', filter: `game_id=eq.${gameId}` },
        (p) => {
          const qid = (p.new as { question_id: string }).question_id
          if (qid !== currentQuestionId.current) return
          setAnsweredFor((prev) => ({ questionId: qid, n: (prev?.questionId === qid ? prev.n : 0) + 1 }))
        })
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [gameId, currentQuestionId])

  useEffect(() => {
    if (!questionId || (phase !== 'question' && phase !== 'reveal')) return
    rpc<number[]>('get_answer_stats', { p_game_id: gameId })
      .then((s) => {
        setStats(s)
        if (phase === 'question') setAnsweredFor({ questionId, n: s.reduce((a, b) => a + b, 0) })
      })
      .catch(() => {})
  }, [gameId, phase, questionId])

  useEffect(() => {
    if (phase !== 'leaderboard' && phase !== 'finished') return
    rpc<LeaderRow[]>('get_leaderboard', { p_game_id: gameId, p_limit: phase === 'finished' ? 3 : 5 })
      .then(setBoard).catch(() => {})
  }, [gameId, phase, pos])

  // Revela solo al acabarse el tiempo o cuando todos respondieron (una vez por pregunta).
  useEffect(() => {
    if (phase !== 'question' || !q || pos === undefined || autoRevealed.current === pos) return
    const everyone = playerCount.current > 0 && answered >= playerCount.current
    if ((remaining !== null && remaining <= 0) || everyone) {
      autoRevealed.current = pos
      // Llamada al servidor disparada por el temporizador: sincroniza con un sistema externo.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void advance('reveal')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, pos, remaining, answered])

  if (error) return <div className={SCREEN}><p className="sticker-note" role="alert">{errorMessage(error)}</p></div>
  if (!game) return <div className={`${SCREEN} items-center justify-center`}><p className="font-display text-[2.4em] text-brand" role="status">Cargando…</p></div>

  const image = q && (q.data.reveal_image_url ?? q.data.image_url)
  const urgent = phase === 'question' && remaining !== null && remaining <= URGENT_S

  return (
    <div className={SCREEN}>
      <header className="flex flex-wrap items-center gap-[1em]">
        <Logo height={44} />
        {(phase === 'question' || phase === 'reveal') && q && (
          <div className="ml-auto flex items-center gap-[0.7em]">
            <span className={CHIP}>Pregunta {q.data.index + 1} de {q.data.total}</span>
            {phase === 'question' && (
              <>
                <span className={CHIP}><span className="tabular-nums">{answered} / {players.length}</span> respondieron</span>
                <span role="timer" aria-label={`${Math.ceil(remaining ?? 0)} segundos`}
                  className={`flex size-[3.2em] items-center justify-center rounded-full border-[0.18em] border-white font-display text-[1.6em] tabular-nums shadow-[0_0.2em_0_rgb(0_20_60/0.45)] ${urgent ? 'bg-alert text-white motion-safe:animate-pulse' : 'bg-white text-navy'}`}>
                  {Math.ceil(remaining ?? 0)}
                </span>
              </>
            )}
          </div>
        )}
      </header>

      {phase === 'lobby' && <Lobby code={game.code} players={players} starting={advancing} onStart={() => advance('start')} />}

      {(phase === 'question' || phase === 'reveal') && q && (
        <>
          {/* key: cada pregunta nueva se "pega" de nuevo. */}
          <h1 key={q.data.id} className="sticker-panel stick-in px-[1.2em] py-[0.8em] text-[2.4em] leading-[1.15] font-extrabold [text-wrap:balance]"
            style={{ '--tilt': '-0.5deg' } as React.CSSProperties}>
            {q.data.text}
          </h1>
          <div className="flex min-h-0 flex-1 items-center gap-[2vw]">
            {/* Al revelar, la imagen de la respuesta (si hay) reemplaza a la de la pregunta. */}
            {image && (
              // eslint-disable-next-line @next/next/no-img-element -- ya viene optimizada desde R2
              <img src={image} alt="" className="max-h-[38vh] w-auto max-w-[40%] rounded-[1em] border-[0.3em] border-white object-contain shadow-[0_0.35em_0_rgb(0_20_60/0.45)] rotate-[0.8deg]" />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-[1.2em]">
              <OptionGrid large>
                {q.data.options.map((o, i) => (
                  <OptionButton key={i} index={i} label={o}
                    dim={phase === 'reveal' && q.data.correct_index !== i}
                    correct={phase === 'reveal' && q.data.correct_index === i}
                    count={phase === 'reveal' ? stats[i] ?? 0 : undefined}
                    total={phase === 'reveal' ? Math.max(1, stats.reduce((a, b) => a + b, 0)) : undefined} large />
                ))}
              </OptionGrid>
              {phase === 'reveal' && q.data.reveal_text && (
                <p className="sticker-panel stick-in px-[1.2em] py-[0.8em] text-[1.4em] font-semibold whitespace-pre-line"
                  style={{ '--tilt': '0.4deg' } as React.CSSProperties}>
                  {q.data.reveal_text}
                </p>
              )}
            </div>
          </div>
          <div className={ACTIONS}>
            {/* A la izquierda: lejos del lugar donde estaban "Empezar" y "Siguiente pregunta". */}
            {phase === 'question' && (
              <button className={`sticker-btn-ghost mr-auto ${BTN}`} disabled={advancing || justOpened} onClick={() => advance('reveal')}>
                Revelar ya
              </button>
            )}
            {phase === 'reveal' && (
              <>
                <button className={`sticker-btn-ghost ${BTN}`} disabled={advancing} onClick={() => advance('leaderboard')}>Ver ranking</button>
                <button className={`sticker-btn ${BTN}`} disabled={advancing} onClick={() => advance('next')}>
                  {q.data.index + 1 >= q.data.total ? 'Ver resultado final' : 'Siguiente pregunta'}
                </button>
              </>
            )}
          </div>
        </>
      )}

      {phase === 'leaderboard' && (
        <>
          <h1 className={TITLE}>Ranking</h1>
          <ol className="flex flex-col gap-[0.6em] text-[1.6em]">
            {board.map((r, i) => (
              <li key={r.nickname} className="sticker-panel stick-in flex items-center gap-[0.8em] px-[1em] py-[0.5em]"
                style={{ '--tilt': i % 2 ? '0.4deg' : '-0.4deg', '--delay': `${i * 90}ms` } as React.CSSProperties}>
                <span className={`flex size-[1.8em] flex-none items-center justify-center rounded-full font-display ${r.rank === 1 ? 'bg-brand text-brand-contrast' : 'bg-white text-navy'}`}>{r.rank}</span>
                <span className="flex-1 truncate font-bold">{r.nickname}</span>
                <span className="font-extrabold tabular-nums">{r.score} <span className="text-[0.7em] font-semibold text-ink-soft">pts</span></span>
              </li>
            ))}
          </ol>
          <div className={ACTIONS}><button className={`sticker-btn ${BTN}`} disabled={advancing} onClick={() => advance('next')}>Siguiente</button></div>
        </>
      )}

      {phase === 'finished' && (
        <>
          <h1 className={`${TITLE} text-center`}>¡Podio final!</h1>
          <div className="mt-auto flex items-end justify-center gap-[1.5vw]">
            {[1, 0, 2].map((i) => board[i] && (
              <div key={board[i].nickname}
                className={`stick-in flex w-[14em] flex-col items-center justify-start gap-[0.3em] rounded-t-[1.4em] border-[0.3em] border-b-0 border-white px-[1em] pt-[1em] text-center ${PODIUM[i].height} ${PODIUM[i].fill}`}
                style={{ '--delay': `${PODIUM[i].delay}ms` } as React.CSSProperties}>
                <div className="text-[3em] leading-none" aria-hidden>{['🥇', '🥈', '🥉'][i]}</div>
                <span className="sr-only">Puesto {i + 1}:</span>
                <strong className="w-full truncate font-display text-[1.5em] leading-tight">{board[i].nickname}</strong>
                <div className="font-bold tabular-nums">{board[i].score} pts</div>
              </div>
            ))}
          </div>
          <div className="flex justify-center">
            <Link className="quiet-link" href="/">Volver al panel</Link>
          </div>
        </>
      )}

      {actionError && <p className="sticker-note" role="alert">{actionError}</p>}
      {/* Recién con la pregunta en pantalla: mientras carga, este lugar es donde estaba "Empezar". */}
      {(phase === 'leaderboard' || ((phase === 'question' || phase === 'reveal') && q)) && (
        <div className="flex justify-end">
          <button className="quiet-link" disabled={advancing} onClick={() => confirm('¿Terminar el quiz ahora?') && advance('finish')}>Terminar quiz</button>
        </div>
      )}
    </div>
  )
}

function Lobby({ code, players, starting, onStart }: { code: string; players: string[]; starting: boolean; onStart: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const url = `${location.origin}/play?code=${code}`

  useEffect(() => {
    if (canvas.current) void QRCode.toCanvas(canvas.current, url, { width: 480, margin: 0 })
  }, [url])

  return (
    <>
      <h1 className={`${TITLE} text-center`}>¡Sumate al quiz!</h1>
      {/* El QR va al centro: es lo que la sala busca con el celular. Se achica con la altura para que todo entre en el proyector. */}
      <div className="flex min-h-0 flex-1 flex-col items-center gap-[1em]">
        <canvas ref={canvas} className="stick-in h-[min(19em,40vh)]! w-[min(19em,40vh)]! flex-none rounded-[1.4em] bg-white p-[0.8em] shadow-[0_0.4em_0_rgb(0_20_60/0.45)] rotate-[-1.2deg]"
          aria-label={`Código QR para unirse: ${url}`} />
        <div className="sticker-panel stick-in px-[1.4em] py-[0.7em] text-center" style={{ '--tilt': '0.8deg', '--delay': '120ms' } as React.CSSProperties}>
          <p className="font-semibold text-ink-soft">Escaneá el QR o entrá a <strong className="text-white">{location.host}/play</strong> con el código</p>
          <p className="font-display text-[3.4em] leading-none tracking-[.12em]">{code}</p>
        </div>
        <p className="text-[1.3em] font-bold" aria-live="polite">
          {players.length === 0 ? 'Esperando al primer jugador…' : `${players.length} ${players.length === 1 ? 'jugador' : 'jugadores'} en la sala`}
        </p>
        <ul className="flex min-h-0 max-w-[60em] flex-wrap justify-center gap-[.6em] overflow-hidden">
          {players.map((p, i) => (
            <li key={p} className="stick-in rounded-full border-[0.15em] border-white bg-white px-[0.9em] py-[0.3em] font-bold text-navy shadow-[0_0.2em_0_rgb(0_20_60/0.4)]"
              style={{ rotate: `${(i % 5) - 2}deg` }}>
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div className={ACTIONS}>
        <button className={`sticker-btn ${BTN}`} disabled={players.length === 0 || starting} onClick={onStart}>
          {starting ? 'Empezando…' : 'Empezar'}
        </button>
      </div>
    </>
  )
}
