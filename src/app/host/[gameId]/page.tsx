'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import QRCode from 'qrcode'
import { supabase } from '@/lib/supabase'
import { errorMessage, rpc, useGame, useLatest, useQuestion, useRemaining, type Game, type LeaderRow } from '@/lib/game'
import { OptionButton, OptionGrid } from '@/components/OptionButton'
import Logo from '@/components/Logo'

// Pantalla del proyector: todo escala en em a partir del font-size base.
const SCREEN = 'flex min-h-dvh flex-col gap-[2vw] p-[3vw] text-[clamp(16px,1.6vw,28px)] [&_h1]:text-[3.2em] [&_h1]:leading-[1.1]'
const BTN = 'px-[1.6em] py-[0.7em] text-[1.1em]'
const ACTIONS = 'mt-auto flex justify-end gap-[1em]'
const REVEAL_LOCK_S = 2
const PODIUM = ['min-h-[14em] bg-brand', 'min-h-[10em] bg-surface', 'min-h-[7em] bg-surface']
const CHIP = 'rounded-full bg-surface px-[0.9em] py-[0.4em]'

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

  if (error) return <div className={SCREEN}><p className="text-bad">{errorMessage(error)}</p></div>
  if (!game) return <div className={SCREEN}><p className="text-muted">Cargando…</p></div>

  return (
    <div className={SCREEN}>
      <Logo height={48} />
      {phase === 'lobby' && <Lobby code={game.code} players={players} starting={advancing} onStart={() => advance('start')} />}

      {(phase === 'question' || phase === 'reveal') && q && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge min-w-0 flex-1">Pregunta {q.data.index + 1} de {q.data.total}</span>
            {phase === 'question' && (
              <>
                <span className="badge">{answered} / {players.length} respondieron</span>
                <span className="timer">{Math.ceil(remaining ?? 0)}</span>
              </>
            )}
          </div>
          <h1>{q.data.text}</h1>
          <OptionGrid large>
            {q.data.options.map((o, i) => (
              <OptionButton key={i} index={i} label={o}
                dim={phase === 'reveal' && q.data.correct_index !== i}
                correct={phase === 'reveal' && q.data.correct_index === i}
                count={phase === 'reveal' ? stats[i] ?? 0 : undefined}
                total={phase === 'reveal' ? Math.max(1, stats.reduce((a, b) => a + b, 0)) : undefined} large />
            ))}
          </OptionGrid>
          <div className={ACTIONS}>
            {/* A la izquierda: lejos del lugar donde estaban "Empezar" y "Siguiente pregunta". */}
            {phase === 'question' && (
              <button className={`btn-secondary mr-auto ${BTN}`} disabled={advancing || justOpened} onClick={() => advance('reveal')}>
                Revelar ya
              </button>
            )}
            {phase === 'reveal' && (
              <>
                <button className={`btn-secondary ${BTN}`} disabled={advancing} onClick={() => advance('leaderboard')}>Ver ranking</button>
                <button className={`btn ${BTN}`} disabled={advancing} onClick={() => advance('next')}>
                  {q.data.index + 1 >= q.data.total ? 'Ver resultado final' : 'Siguiente pregunta'}
                </button>
              </>
            )}
          </div>
        </>
      )}

      {phase === 'leaderboard' && (
        <>
          <h1>Ranking</h1>
          <ol className="flex flex-col gap-2 text-[1.5em]">
            {board.map((r) => (
              <li key={r.nickname} className="flex items-center gap-4 rounded-[10px] bg-surface px-4 py-3">
                <span className="w-[2ch] font-extrabold">{r.rank}</span>
                <span className="flex-1 truncate">{r.nickname}</span>
                <span className="font-bold tabular-nums">{r.score}</span>
              </li>
            ))}
          </ol>
          <div className={ACTIONS}><button className={`btn ${BTN}`} disabled={advancing} onClick={() => advance('next')}>Siguiente</button></div>
        </>
      )}

      {phase === 'finished' && (
        <>
          <h1 className="text-center">¡Podio final!</h1>
          <div className="flex items-end justify-center gap-[2vw]">
            {[1, 0, 2].map((i) => board[i] && (
              <div key={board[i].nickname} className={`min-w-[9em] rounded-t-card px-[2em] py-[1em] text-center ${PODIUM[i]}`}>
                <div className="text-[3em]">{['🥇', '🥈', '🥉'][i]}</div>
                <strong>{board[i].nickname}</strong>
                <div>{board[i].score} pts</div>
              </div>
            ))}
          </div>
        </>
      )}

      {actionError && <p className="text-bad" role="alert">{actionError}</p>}
      {/* Recién con la pregunta en pantalla: mientras carga, este lugar es donde estaba "Empezar". */}
      {(phase === 'leaderboard' || ((phase === 'question' || phase === 'reveal') && q)) && (
        <div className="flex justify-end gap-[1em]">
          <button className={`btn-secondary ${BTN}`} disabled={advancing} onClick={() => confirm('¿Terminar el quiz ahora?') && advance('finish')}>Terminar</button>
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
      <h1>Sumate al quiz</h1>
      <div className="grid grid-cols-[auto_1fr] items-start gap-[4vw]">
        <canvas ref={canvas} className="h-[20em]! w-[20em]! rounded-card bg-white p-[1em]" aria-label={`Código QR para unirse: ${url}`} />
        <div>
          <p className="text-muted">Escaneá el QR o entrá a {location.host}/play con el código</p>
          <p className="text-[5em] font-extrabold tracking-[.15em]">{code}</p>
          <p className="mt-[1em] mb-[.5em]">{players.length} {players.length === 1 ? 'jugador' : 'jugadores'}</p>
          <div className="flex flex-wrap gap-[.6em]">{players.map((p) => <span key={p} className={CHIP}>{p}</span>)}</div>
        </div>
      </div>
      <div className={ACTIONS}>
        <button className={`btn ${BTN}`} disabled={players.length === 0 || starting} onClick={onStart}>
          {starting ? 'Empezando…' : 'Empezar'}
        </button>
      </div>
    </>
  )
}
