import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

export type Phase = 'lobby' | 'question' | 'reveal' | 'leaderboard' | 'finished'

export interface Game {
  id: string
  quiz_id: string
  code: string
  host_id: string
  phase: Phase
  current_position: number
  question_started_at: string | null
  // La partida que se lanzó después de esta en el mismo proyector (ver create_next_game).
  next_game_id: string | null
  // El anfitrión cerró el evento desde el podio: los jugadores pasan a /gracias (ver close_game).
  closed_at: string | null
}

export interface CurrentQuestion {
  id: string
  index: number
  total: number
  text: string
  image_url: string | null
  options: string[]
  time_limit_s: number
  question_started_at: string
  server_now: string
  correct_index: number | null
  // Solo llegan desde el reveal.
  reveal_image_url: string | null
  reveal_text: string | null
}

export interface Standing {
  nickname: string
  avatar: string
  score: number
  rank: number
  answered: boolean
  last_correct: boolean | null
  last_points: number | null
}

export interface Player {
  nickname: string
  avatar: string
}

export interface LeaderRow {
  nickname: string
  avatar: string
  score: number
  rank: number
}

// Tope de quizzes por usuario común; el que manda es el trigger de 0011_quiz_limit.sql (mismo número).
export const QUIZ_LIMIT = 15

const ERRORS: Record<string, string> = {
  game_not_found: 'No encontramos ese código.',
  game_finished: 'Este quiz ya terminó.',
  game_full: 'La sala está llena.',
  nickname_taken: 'Ese nombre ya está en uso, elegí otro.',
  invalid_nickname: 'El nombre debe tener entre 1 y 20 caracteres.',
  invalid_avatar: 'Elegí un personaje.',
  too_late: 'Se acabó el tiempo.',
  already_answered: 'Ya respondiste esta pregunta.',
  not_accepting_answers: 'La pregunta ya cerró.',
  forbidden: 'No tenés permiso para esto.',
  quiz_empty: 'El quiz no tiene preguntas.',
  quiz_limit: `Llegaste al límite de ${QUIZ_LIMIT} quizzes. Borrá alguno para crear otro.`,
  invalid_transition: 'Ese paso ya no es válido.',
  // /api/generate (quiz armado con IA)
  ai_busy: 'La IA gratuita llegó a su límite por ahora. Esperá un minuto y probá de nuevo.',
  ai_failed: 'La IA no pudo armar el quiz. Probá de nuevo o cambiá el tema.',
  ai_not_configured: 'Falta configurar la clave de Gemini (GEMINI_API_KEY).',
}

/** Llama a cb cuando la pestaña vuelve a verse: un celular bloqueado o una pestaña dormida pierden avisos de Realtime. */
function onVisible(cb: () => void) {
  const handler = () => document.visibilityState === 'visible' && cb()
  document.addEventListener('visibilitychange', handler)
  return () => document.removeEventListener('visibilitychange', handler)
}

export function errorMessage(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e)
  return ERRORS[msg] ?? 'Algo salió mal. Intentá de nuevo.'
}

export async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}

/** Fila de la partida en vivo (por id o por código). */
export function useGame(key: { id: string } | { code: string }) {
  const [game, setGame] = useState<Game | null>(null)
  const [error, setError] = useState<string | null>(null)
  const col = 'id' in key ? 'id' : 'code'
  const val = 'id' in key ? key.id : key.code.toUpperCase()

  useEffect(() => {
    let gameId: string | null = null
    let cancelled = false
    const load = async () => {
      const { data, error } = await supabase.from('games').select('*').eq(col, val).maybeSingle()
      if (cancelled) return null
      if (error || !data) {
        setError('game_not_found')
        return null
      }
      setGame(data as Game)
      return data as Game
    }
    const channel = supabase.channel(`game-${val}`)
    load().then((g) => {
      if (!g) return
      gameId = g.id
      channel
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
          (p) => setGame(p.new as Game))
        // al reconectar se pueden haber perdido eventos
        .subscribe((status) => status === 'SUBSCRIBED' && load())
    })
    const offVisible = onVisible(() => void load())
    return () => {
      cancelled = true
      offVisible()
      supabase.removeChannel(channel)
    }
  }, [col, val])

  return { game, error, setGame }
}

/** Pregunta actual; se recarga cuando cambia la fase o la posición. */
export function useQuestion(game: Game | null) {
  const [q, setQ] = useState<{ data: CurrentQuestion; receivedAt: number } | null>(null)
  const phase = game?.phase
  const pos = game?.current_position
  const code = game?.code

  const active = !!code && !!phase && phase !== 'lobby' && phase !== 'finished'

  useEffect(() => {
    if (!active) return
    let cancelled = false
    rpc<CurrentQuestion>('get_current_question', { p_code: code })
      .then((data) => !cancelled && setQ({ data, receivedAt: Date.now() }))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [active, code, phase, pos])

  // Hasta que llega la pregunta nueva no se expone la anterior (su tiempo ya venció y dispararía el reveal).
  return active && q && q.data.index === pos ? q : null
}

/** Segundos restantes, corrigiendo el desfase entre el reloj del celular y el del servidor. */
export function useRemaining(q: ReturnType<typeof useQuestion>) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(t)
  }, [])
  if (!q) return null
  const offset = Date.parse(q.data.server_now) - q.receivedAt
  const elapsed = (now + offset - Date.parse(q.data.question_started_at)) / 1000
  return Math.max(0, q.data.time_limit_s - elapsed)
}

export function useLatest<T>(value: T) {
  const ref = useRef(value)
  // Antes que los efectos normales, para que lean el valor del mismo render.
  useLayoutEffect(() => { ref.current = value })
  return ref
}

/**
 * Lo que ve el anfitrión en vivo: jugadores, respuestas a la pregunta actual, distribución y ranking.
 * Lo comparten la pantalla del proyector y el control desde el panel.
 */
export function useHostLive(game: Game | null, questionId: string | undefined) {
  const gameId = game?.id
  const phase = game?.phase
  const pos = game?.current_position
  const [players, setPlayers] = useState<Player[]>([])
  // Respuestas contadas por pregunta, para que el conteo de la anterior no se arrastre a la nueva.
  const [answeredFor, setAnsweredFor] = useState<{ questionId: string; n: number } | null>(null)
  const [stats, setStats] = useState<number[]>([])
  const [board, setBoard] = useState<LeaderRow[]>([])
  const currentQuestionId = useLatest(questionId)

  // Jugadores en vivo
  useEffect(() => {
    if (!gameId) return
    const load = () =>
      supabase.from('players').select('nickname, avatar').eq('game_id', gameId).order('created_at')
        .then(({ data }) => setPlayers(data ?? []))
    const ch = supabase.channel(`players-${gameId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'players', filter: `game_id=eq.${gameId}` },
        (p) => {
          const { nickname, avatar } = p.new as Player
          setPlayers((prev) => [...prev, { nickname, avatar }])
        })
      .subscribe((s) => s === 'SUBSCRIBED' && load())
    const offVisible = onVisible(() => void load())
    return () => {
      offVisible()
      void supabase.removeChannel(ch)
    }
  }, [gameId])

  // Respuestas en vivo: se cuentan inserts y se recarga la distribución al cambiar de fase.
  useEffect(() => {
    if (!gameId) return
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
    if (!gameId || !questionId || (phase !== 'question' && phase !== 'reveal')) return
    const load = () => rpc<number[]>('get_answer_stats', { p_game_id: gameId })
      .then((s) => {
        setStats(s)
        if (phase === 'question') setAnsweredFor({ questionId, n: s.reduce((a, b) => a + b, 0) })
      })
      .catch(() => {})
    void load()
    return onVisible(() => void load())
  }, [gameId, phase, questionId])

  useEffect(() => {
    if (!gameId || (phase !== 'leaderboard' && phase !== 'finished')) return
    rpc<LeaderRow[]>('get_leaderboard', { p_game_id: gameId, p_limit: phase === 'finished' ? 3 : 5 })
      .then(setBoard).catch(() => {})
  }, [gameId, phase, pos])

  const answered = answeredFor && answeredFor.questionId === questionId ? answeredFor.n : 0
  return { players, answered, stats, board }
}
