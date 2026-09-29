import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import QRCode from 'qrcode'
import { supabase } from '../../lib/supabase'
import { errorMessage, rpc, useGame, useLatest, useQuestion, useRemaining, type Game, type LeaderRow } from '../../lib/game'
import { OptionButton } from '../shared/Option'
import Logo from '../shared/Logo'

export default function Host() {
  const { gameId = '' } = useParams()
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

  const advance = async (action: string) => {
    setActionError('')
    try {
      // Se aplica la respuesta directo, sin esperar el aviso de Realtime.
      setGame(await rpc<Game>('host_advance', { p_game_id: gameId, p_action: action }))
    } catch (e) {
      setActionError(errorMessage(e))
    }
  }

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
      void advance('reveal')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, pos, remaining, answered])

  if (error) return <div className="host"><p className="error">{errorMessage(error)}</p></div>
  if (!game) return <div className="host"><p className="muted">Cargando…</p></div>

  return (
    <div className="host">
      <Logo height={48} />
      {phase === 'lobby' && <Lobby code={game.code} players={players} onStart={() => advance('start')} />}

      {(phase === 'question' || phase === 'reveal') && q && (
        <>
          <div className="row">
            <span className="badge grow">Pregunta {q.data.index + 1} de {q.data.total}</span>
            {phase === 'question' && (
              <>
                <span className="badge">{answered} / {players.length} respondieron</span>
                <span className="timer">{Math.ceil(remaining ?? 0)}</span>
              </>
            )}
          </div>
          <h1>{q.data.text}</h1>
          <div className="options">
            {q.data.options.map((o, i) => (
              <OptionButton key={i} index={i} label={o}
                dim={phase === 'reveal' && q.data.correct_index !== i}
                correct={phase === 'reveal' && q.data.correct_index === i}
                count={phase === 'reveal' ? stats[i] ?? 0 : undefined}
                total={phase === 'reveal' ? Math.max(1, stats.reduce((a, b) => a + b, 0)) : undefined} />
            ))}
          </div>
          <div className="host-actions">
            {phase === 'question' && <button className="btn secondary" onClick={() => advance('reveal')}>Revelar ya</button>}
            {phase === 'reveal' && (
              <>
                <button className="btn secondary" onClick={() => advance('leaderboard')}>Ver ranking</button>
                <button className="btn" onClick={() => advance('next')}>
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
          <ol className="leaderboard">
            {board.map((r) => (
              <li key={r.nickname}><span className="rank">{r.rank}</span><span className="name">{r.nickname}</span><span className="pts">{r.score}</span></li>
            ))}
          </ol>
          <div className="host-actions"><button className="btn" onClick={() => advance('next')}>Siguiente</button></div>
        </>
      )}

      {phase === 'finished' && (
        <>
          <h1 style={{ textAlign: 'center' }}>¡Podio final!</h1>
          <div className="podium">
            {[1, 0, 2].map((i) => board[i] && (
              <div key={board[i].nickname} className={`p${i + 1}`}>
                <div style={{ fontSize: '3em' }}>{['🥇', '🥈', '🥉'][i]}</div>
                <strong>{board[i].nickname}</strong>
                <div>{board[i].score} pts</div>
              </div>
            ))}
          </div>
        </>
      )}

      {actionError && <p className="error" role="alert">{actionError}</p>}
      {phase !== 'finished' && phase !== 'lobby' && (
        <div className="host-actions" style={{ marginTop: 0 }}>
          <button className="btn secondary" onClick={() => confirm('¿Terminar el quiz ahora?') && advance('finish')}>Terminar</button>
        </div>
      )}
    </div>
  )
}

function Lobby({ code, players, onStart }: { code: string; players: string[]; onStart: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const url = `${location.origin}/play?code=${code}`

  useEffect(() => {
    if (canvas.current) void QRCode.toCanvas(canvas.current, url, { width: 480, margin: 0 })
  }, [url])

  return (
    <>
      <h1>Sumate al quiz</h1>
      <div className="lobby">
        <canvas ref={canvas} aria-label={`Código QR para unirse: ${url}`} />
        <div>
          <p className="muted">Escaneá el QR o entrá a {location.host}/play con el código</p>
          <p className="code">{code}</p>
          <p style={{ margin: '1em 0 .5em' }}>{players.length} {players.length === 1 ? 'jugador' : 'jugadores'}</p>
          <div className="chips">{players.map((p) => <span key={p} className="chip">{p}</span>)}</div>
        </div>
      </div>
      <div className="host-actions">
        <button className="btn" disabled={players.length === 0} onClick={onStart}>Empezar</button>
      </div>
    </>
  )
}
